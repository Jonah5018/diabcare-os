-- Audit export requests and retention planning. No deletion worker or legal policy.
alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type in ('patients', 'appointments', 'consultations', 'vitals', 'laboratory_results',
    'prescriptions', 'prescription_items', 'follow_ups', 'staff_invitations',
    'organizations', 'users', 'audit_events', 'audit_retention_settings')
);
alter table public.audit_events drop constraint audit_events_operation_check;
alter table public.audit_events add constraint audit_events_operation_check check (
  operation in ('INSERT', 'UPDATE', 'DELETE', 'EXPORT')
);

create index audit_events_clinic_entity_page_idx
  on public.audit_events (organization_id, entity_type, created_at desc, id desc);
create index audit_events_clinic_actor_page_idx
  on public.audit_events (organization_id, actor_id, created_at desc, id desc);
create index audit_events_clinic_record_page_idx
  on public.audit_events (organization_id, record_id, created_at desc, id desc);

create table public.audit_retention_settings (
  organization_id uuid primary key references public.organizations (id),
  retention_days integer check (retention_days between 1 and 36500),
  legal_hold boolean not null default true,
  archive_required boolean not null default true check (archive_required),
  deletion_enabled boolean not null default false check (not deletion_enabled),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  constraint audit_retention_editor_clinic_fkey foreign key (updated_by, organization_id)
    references public.users (id, organization_id)
);
create index audit_retention_editor_idx on public.audit_retention_settings (updated_by, organization_id);
alter table public.audit_retention_settings enable row level security;
revoke all on public.audit_retention_settings from public, anon, authenticated;
grant select on public.audit_retention_settings to authenticated;
create policy "Clinic administrators read retention drafts"
  on public.audit_retention_settings for select to authenticated using (
    organization_id = (select private.current_organization_id())
    and exists (select 1 from public.users u where u.id = (select auth.uid())
      and u.is_active and u.role in ('platform_owner', 'organization_admin'))
  );

create function private.save_audit_retention_draft(p_days integer, p_hold boolean)
returns void language plpgsql security definer set search_path = '' as $command$
declare
  v_clinic uuid;
  v_existed boolean;
begin
  v_clinic := private.administration_clinic();
  if p_hold is null or (p_days is not null and (p_days < 1 or p_days > 36500)) then
    raise exception using errcode = '22023', message = 'Invalid retention draft';
  end if;
  select exists (select 1 from public.audit_retention_settings where organization_id = v_clinic)
    into v_existed;
  insert into public.audit_retention_settings (organization_id, retention_days, legal_hold, updated_by)
  values (v_clinic, p_days, p_hold, auth.uid())
  on conflict (organization_id) do update set retention_days = excluded.retention_days,
    legal_hold = excluded.legal_hold, updated_by = excluded.updated_by, updated_at = now();
  insert into public.audit_events (organization_id, actor_id, entity_type, record_id, operation, details)
  values (v_clinic, auth.uid(), 'audit_retention_settings', v_clinic,
    case when v_existed then 'UPDATE' else 'INSERT' end,
    jsonb_build_object('retention_days', p_days, 'legal_hold', p_hold, 'deletion_enabled', false));
end;
$command$;
create function public.save_audit_retention_draft(p_days integer, p_hold boolean)
returns void language sql security invoker set search_path = '' as $wrapper$
  select private.save_audit_retention_draft(p_days, p_hold);
$wrapper$;

-- Records a request, never a claim that a file was downloaded or delivered.
create function private.record_audit_export_request(p_from date, p_to date, p_count integer)
returns uuid language plpgsql security definer set search_path = '' as $command$
declare
  v_clinic uuid;
  v_id uuid := gen_random_uuid();
begin
  v_clinic := private.administration_clinic();
  if p_from is null or p_to is null or p_to - p_from not between 0 and 30
    or p_count is null or p_count not between 0 and 200 then
    raise exception using errcode = '22023', message = 'Invalid bounded export request';
  end if;
  insert into public.audit_events (id, organization_id, actor_id, entity_type, record_id, operation, details)
  values (v_id, v_clinic, auth.uid(), 'audit_events', v_id, 'EXPORT',
    jsonb_build_object('stage', 'requested', 'from', p_from, 'to', p_to, 'row_count', p_count));
  return v_id;
end;
$command$;
create function public.record_audit_export_request(p_from date, p_to date, p_count integer)
returns uuid language sql security invoker set search_path = '' as $wrapper$
  select private.record_audit_export_request(p_from, p_to, p_count);
$wrapper$;

revoke all on function private.save_audit_retention_draft(integer, boolean) from public, anon;
revoke all on function public.save_audit_retention_draft(integer, boolean) from public, anon;
revoke all on function private.record_audit_export_request(date, date, integer) from public, anon;
revoke all on function public.record_audit_export_request(date, date, integer) from public, anon;
grant execute on function private.save_audit_retention_draft(integer, boolean) to authenticated;
grant execute on function public.save_audit_retention_draft(integer, boolean) to authenticated;
grant execute on function private.record_audit_export_request(date, date, integer) to authenticated;
grant execute on function public.record_audit_export_request(date, date, integer) to authenticated;
