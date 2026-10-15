-- Private patient documents: no public URLs, overwrite or delete policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-documents', 'clinical-documents', false, 786432,
  array['application/pdf', 'image/png', 'image/jpeg']);

create table public.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  patient_id uuid not null,
  uploaded_by uuid not null,
  request_id uuid not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 160
    and display_name !~ '[[:cntrl:]/\\]'),
  category text not null check (category in ('laboratory', 'referral', 'clinical', 'legacy')),
  content_type text not null check (content_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes between 1 and 786432),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  object_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_patient_clinic_fkey foreign key (patient_id, organization_id)
    references public.patients (id, organization_id),
  constraint documents_uploader_clinic_fkey foreign key (uploaded_by, organization_id)
    references public.users (id, organization_id),
  unique (organization_id, uploaded_by, request_id),
  check (object_path = organization_id::text || '/' || patient_id::text || '/' || id::text ||
    case content_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end)
);
create index documents_patient_page_idx
  on public.clinical_documents (organization_id, patient_id, created_at desc, id desc);
create index documents_uploader_pending_idx
  on public.clinical_documents (uploaded_by, organization_id, status);
alter table public.clinical_documents enable row level security;
revoke all on public.clinical_documents from public, anon, authenticated;
grant select on public.clinical_documents to authenticated;
create policy "Active clinic staff read document metadata"
  on public.clinical_documents for select to authenticated using (
    organization_id = (select private.current_organization_id())
  );

create function private.document_clinic(p_upload boolean)
returns uuid language plpgsql security definer set search_path = '' as $guard$
declare
  v_actor public.users%rowtype;
begin
  select * into v_actor from public.users where id = auth.uid() and is_active for share;
  if not found or v_actor.organization_id is null or v_actor.role not in
    ('platform_owner', 'organization_admin', 'doctor', 'nurse', 'lab_scientist', 'receptionist')
    or (p_upload and v_actor.role = 'receptionist') then
    raise exception using errcode = '42501', message = 'Document permission denied';
  end if;
  return v_actor.organization_id;
end;
$guard$;
revoke all on function private.document_clinic(boolean) from public, anon, authenticated;

create function private.reserve_clinical_document(
  p_patient_id uuid, p_request_id uuid, p_name text, p_category text,
  p_type text, p_size integer, p_checksum text
)
returns jsonb language plpgsql security definer set search_path = '' as $command$
declare
  v_clinic uuid := private.document_clinic(true);
  v_row public.clinical_documents%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if p_request_id is null or p_name is null or length(btrim(p_name)) not between 1 and 160
    or p_name ~ '[[:cntrl:]/\\]' or p_category is null
    or p_category not in ('laboratory', 'referral', 'clinical', 'legacy') or p_type is null
    or p_type not in ('application/pdf', 'image/png', 'image/jpeg') or p_size is null
    or p_size not between 1 and 786432 or p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid document metadata';
  end if;
  if not exists (select 1 from public.patients where id = p_patient_id and organization_id = v_clinic) then
    raise exception using errcode = '42501', message = 'Patient unavailable in clinic';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('document:' || auth.uid()::text, 0));
  select * into v_row from public.clinical_documents
    where organization_id = v_clinic and uploaded_by = auth.uid() and request_id = p_request_id;
  if found then
    if (v_row.patient_id, v_row.display_name, v_row.category, v_row.content_type, v_row.size_bytes, v_row.checksum)
      is distinct from (p_patient_id, btrim(p_name), p_category, p_type, p_size, p_checksum) then
      raise exception using errcode = '40001', message = 'Upload request changed; start a new request';
    end if;
    return to_jsonb(v_row);
  end if;
  if (select count(*) from public.clinical_documents where uploaded_by = auth.uid()
    and organization_id = v_clinic and status = 'pending') >= 10 then
    raise exception using errcode = '54000', message = 'Resume pending uploads before starting more';
  end if;
  insert into public.clinical_documents (id, organization_id, patient_id, uploaded_by, request_id,
    display_name, category, content_type, size_bytes, checksum, object_path)
  values (v_id, v_clinic, p_patient_id, auth.uid(), p_request_id, btrim(p_name), p_category, p_type, p_size,
    p_checksum, v_clinic::text || '/' || p_patient_id::text || '/' || v_id::text ||
      case p_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end)
  returning * into v_row;
  return to_jsonb(v_row);
end;
$command$;
create function public.reserve_clinical_document(
  p_patient_id uuid, p_request_id uuid, p_name text, p_category text,
  p_type text, p_size integer, p_checksum text
)
returns jsonb language sql security invoker set search_path = '' as $wrapper$
  select private.reserve_clinical_document(p_patient_id, p_request_id, p_name, p_category, p_type, p_size, p_checksum);
$wrapper$;

create policy "Upload only reserved clinic document paths"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'clinical-documents'
    and coalesce(owner_id, owner::text) = (select auth.uid())::text
    and exists (select 1 from public.clinical_documents d
      join public.users u on u.id = (select auth.uid()) and u.organization_id = d.organization_id
      where d.object_path = name and d.status = 'pending' and d.uploaded_by = u.id
        and u.is_active and u.role in ('platform_owner', 'organization_admin', 'doctor', 'nurse', 'lab_scientist'))
  );
create policy "Read private documents within active clinic"
  on storage.objects for select to authenticated using (
    bucket_id = 'clinical-documents'
    and exists (select 1 from public.clinical_documents d
      join public.users u on u.id = (select auth.uid()) and u.organization_id = d.organization_id
      where d.object_path = name and u.is_active and (d.status = 'ready'
        or d.uploaded_by = u.id or u.role in ('platform_owner', 'organization_admin')))
  );

-- Storage provider metadata is checked here. Byte signatures/checksums are
-- checked by the server application; this is not a malware scan.
create function private.finalize_clinical_document(p_document_id uuid)
returns void language plpgsql security definer set search_path = '' as $command$
declare
  v_clinic uuid := private.document_clinic(true);
  v_row public.clinical_documents%rowtype;
begin
  select * into v_row from public.clinical_documents where id = p_document_id
    and organization_id = v_clinic for update;
  if not found or (v_row.uploaded_by <> auth.uid() and not exists (select 1 from public.users
    where id = auth.uid() and role in ('platform_owner', 'organization_admin'))) then
    raise exception using errcode = '42501', message = 'Document unavailable for verification';
  end if;
  if v_row.status = 'ready' then return; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'clinical-documents'
    and o.name = v_row.object_path and coalesce(o.owner_id, o.owner::text) = v_row.uploaded_by::text
    and o.metadata->>'size' = v_row.size_bytes::text and o.metadata->>'mimetype' = v_row.content_type) then
    raise exception using errcode = '22023', message = 'Stored object metadata does not match reservation';
  end if;
  update public.clinical_documents set status = 'ready', updated_at = now() where id = v_row.id;
end;
$command$;
create function public.finalize_clinical_document(p_document_id uuid)
returns void language sql security invoker set search_path = '' as $wrapper$
  select private.finalize_clinical_document(p_document_id);
$wrapper$;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type in ('patients', 'appointments', 'consultations', 'vitals', 'laboratory_results',
    'prescriptions', 'prescription_items', 'follow_ups', 'staff_invitations', 'organizations',
    'users', 'audit_events', 'audit_retention_settings', 'clinical_documents')
);
alter table public.audit_events drop constraint audit_events_operation_check;
alter table public.audit_events add constraint audit_events_operation_check check (
  operation in ('INSERT', 'UPDATE', 'DELETE', 'EXPORT', 'ACCESS')
);
create function private.record_document_metadata_audit()
returns trigger language plpgsql security definer set search_path = '' as $audit$
begin
  insert into public.audit_events (organization_id, actor_id, entity_type, record_id, operation, details)
  values (new.organization_id, auth.uid(), 'clinical_documents', new.id, tg_op,
    jsonb_build_object('status', new.status, 'category', new.category, 'content_type', new.content_type)
    || case when tg_op = 'UPDATE' then jsonb_build_object('previous_status', old.status) else '{}'::jsonb end);
  return new;
end;
$audit$;
revoke all on function private.record_document_metadata_audit() from public, anon, authenticated;
create trigger clinical_document_audit after insert or update on public.clinical_documents
  for each row execute function private.record_document_metadata_audit();

create function private.record_document_access_request(p_document_id uuid)
returns void language plpgsql security definer set search_path = '' as $command$
declare
  v_clinic uuid := private.document_clinic(false);
begin
  if not exists (select 1 from public.clinical_documents where id = p_document_id
    and organization_id = v_clinic and status = 'ready') then
    raise exception using errcode = '42501', message = 'Document unavailable';
  end if;
  insert into public.audit_events (organization_id, actor_id, entity_type, record_id, operation, details)
  values (v_clinic, auth.uid(), 'clinical_documents', p_document_id, 'ACCESS',
    jsonb_build_object('stage', 'requested'));
end;
$command$;
create function public.record_document_access_request(p_document_id uuid)
returns void language sql security invoker set search_path = '' as $wrapper$
  select private.record_document_access_request(p_document_id);
$wrapper$;

revoke all on function private.reserve_clinical_document(uuid, uuid, text, text, text, integer, text) from public, anon;
revoke all on function public.reserve_clinical_document(uuid, uuid, text, text, text, integer, text) from public, anon;
revoke all on function private.finalize_clinical_document(uuid) from public, anon;
revoke all on function public.finalize_clinical_document(uuid) from public, anon;
revoke all on function private.record_document_access_request(uuid) from public, anon;
revoke all on function public.record_document_access_request(uuid) from public, anon;
grant execute on function private.reserve_clinical_document(uuid, uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.reserve_clinical_document(uuid, uuid, text, text, text, integer, text) to authenticated;
grant execute on function private.finalize_clinical_document(uuid) to authenticated;
grant execute on function public.finalize_clinical_document(uuid) to authenticated;
grant execute on function private.record_document_access_request(uuid) to authenticated;
grant execute on function public.record_document_access_request(uuid) to authenticated;
