-- Storage object metadata fixtures only; no real file bytes are uploaded.
-- Everything in this suite is rolled back.
begin;
do $verify$
declare
  clinic uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  other_actor uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  other_patient uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  invalid_document_id uuid := gen_random_uuid();
  document jsonb;
  retry jsonb;
  pending jsonb;
  blocked boolean;
  affected integer;
  allowed_role text;
begin
  if not exists (select 1 from storage.buckets where id = 'clinical-documents'
    and not public and file_size_limit = 786432 and allowed_mime_types = array['application/pdf','image/png','image/jpeg']) then
    raise exception 'Private bucket limits missing';
  end if;
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary document clinic', 'verify-doc-' || clinic),
    (other, 'Temporary foreign document clinic', 'verify-doc-' || other);
  insert into auth.users (id, email, aud, role) values
    (actor, actor || '@example.invalid', 'authenticated', 'authenticated'),
    (other_actor, other_actor || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (actor, clinic, 'Synthetic uploader', actor || '@example.invalid', 'doctor', true),
    (other_actor, other, 'Synthetic foreign admin', other_actor || '@example.invalid', 'organization_admin', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name) values
    (patient, clinic, 'VERIFY-DOC-' || patient, 'Synthetic', 'Patient'),
    (other_patient, other, 'VERIFY-DOC-' || other_patient, 'Synthetic', 'Foreign patient');
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  document := public.reserve_clinical_document(patient, request_id, 'Synthetic.pdf', 'clinical', 'application/pdf', 8, repeat('a',64));
  retry := public.reserve_clinical_document(patient, request_id, 'Synthetic.pdf', 'clinical', 'application/pdf', 8, repeat('a',64));
  if document->>'id' <> retry->>'id' or document->>'organization_id' <> clinic::text
    or document->>'uploaded_by' <> actor::text or document->>'object_path' not like clinic::text || '/' || patient::text || '/%.pdf' then
    raise exception 'Reservation attribution/path/idempotency failed';
  end if;
  blocked := false;
  begin perform public.reserve_clinical_document(patient, request_id, 'Changed.pdf', 'clinical', 'application/pdf', 8, repeat('a',64));
  exception when serialization_failure then blocked := true; end;
  if not blocked then raise exception 'Changed request reused reservation'; end if;
  blocked := false;
  begin perform public.reserve_clinical_document(other_patient, gen_random_uuid(), 'Synthetic.pdf', 'clinical', 'application/pdf', 8, repeat('a',64));
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Foreign patient upload reserved'; end if;
  blocked := false;
  begin perform public.reserve_clinical_document(patient, gen_random_uuid(), '../unsafe.pdf', 'clinical', 'application/pdf', 8, repeat('a',64));
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Unsafe name accepted'; end if;
  blocked := false;
  begin perform public.reserve_clinical_document(patient, gen_random_uuid(), 'Synthetic.html', 'clinical', 'text/html', 8, repeat('a',64));
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Disallowed MIME accepted'; end if;
  blocked := false;
  begin perform public.reserve_clinical_document(patient, gen_random_uuid(), 'Synthetic.pdf', 'clinical', 'application/pdf', 786433, repeat('a',64));
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Oversize reservation accepted'; end if;
  blocked := false;
  begin perform public.finalize_clinical_document((document->>'id')::uuid);
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Missing object marked ready'; end if;
  blocked := false;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('clinical-documents', clinic || '/arbitrary.pdf', actor::text);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Unreserved object uploaded'; end if;
  blocked := false;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('clinical-documents', document->>'object_path', other_actor::text);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Spoofed object owner accepted'; end if;
  insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('clinical-documents', document->>'object_path', actor::text, '{"size":9,"mimetype":"application/pdf"}');
  blocked := false;
  begin perform public.finalize_clinical_document((document->>'id')::uuid);
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Wrong object size finalized'; end if;
  execute 'reset role';
  update storage.objects set metadata = '{"size":8,"mimetype":"application/pdf"}' where name = document->>'object_path';
  execute 'set local role authenticated';
  perform public.finalize_clinical_document((document->>'id')::uuid);
  perform public.finalize_clinical_document((document->>'id')::uuid);
  if not exists (select 1 from public.clinical_documents where id = (document->>'id')::uuid and status = 'ready') then
    raise exception 'Matching object not finalized';
  end if;
  perform public.record_document_access_request((document->>'id')::uuid);
  update storage.objects set name = clinic || '/overwrite.pdf' where name = document->>'object_path';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Object overwrite permitted'; end if;
  affected := 0;
  begin
    delete from storage.objects where name = document->>'object_path';
    get diagnostics affected = row_count;
  exception when insufficient_privilege then affected := 0;
  end;
  if affected <> 0 then raise exception 'Object delete permitted'; end if;
  blocked := false;
  begin update public.clinical_documents set display_name = 'Tampered.pdf';
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Direct metadata mutation permitted'; end if;

  perform set_config('request.jwt.claim.sub', other_actor::text, true);
  if exists (select 1 from public.clinical_documents where id = (document->>'id')::uuid)
    or exists (select 1 from storage.objects where name = document->>'object_path') then
    raise exception 'Foreign document metadata/object exposed';
  end if;
  blocked := false;
  begin perform public.record_document_access_request((document->>'id')::uuid);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Foreign access request permitted'; end if;
  blocked := false;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('clinical-documents', document->>'object_path', other_actor::text);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Foreign path upload permitted'; end if;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'reset role';
  foreach allowed_role in array array['nurse','lab_scientist','organization_admin','platform_owner'] loop
    update public.users set role = allowed_role::public.user_role where id = actor;
    execute 'set local role authenticated';
    pending := public.reserve_clinical_document(patient, gen_random_uuid(), 'Synthetic.png', 'laboratory', 'image/png', 8, repeat('b',64));
    execute 'reset role';
  end loop;
  execute 'set local role authenticated';
  for affected in 1..6 loop
    perform public.reserve_clinical_document(patient, gen_random_uuid(), 'Synthetic.png', 'clinical', 'image/png', 8, repeat('b',64));
  end loop;
  blocked := false;
  begin perform public.reserve_clinical_document(patient, gen_random_uuid(), 'Synthetic.png', 'clinical', 'image/png', 8, repeat('b',64));
  exception when program_limit_exceeded then blocked := true; end;
  if not blocked then raise exception 'Pending upload cap exceeded'; end if;
  execute 'reset role';
  blocked := false;
  begin
    insert into public.clinical_documents (id, organization_id, patient_id, uploaded_by, request_id,
      display_name, category, content_type, size_bytes, checksum, object_path)
    select invalid_document_id, clinic, other_patient, actor, gen_random_uuid(), 'Synthetic.pdf', 'clinical',
      'application/pdf', 8, repeat('a',64), clinic || '/' || other_patient || '/' || invalid_document_id || '.pdf';
  exception when foreign_key_violation then blocked := true; end;
  if not blocked then raise exception 'Tenant-safe document constraint missing'; end if;
  if exists (select 1 from public.audit_events where record_id = (document->>'id')::uuid
    and (details ? 'display_name' or details ? 'checksum' or details ? 'object_path')) then
    raise exception 'Audit contains unnecessary document content';
  end if;
  update public.users set role = 'receptionist' where id = actor;
  execute 'set local role authenticated';
  if not exists (select 1 from storage.objects where name = document->>'object_path') then
    raise exception 'Receptionist could not read ready clinic document';
  end if;
  blocked := false;
  begin perform public.reserve_clinical_document(patient, gen_random_uuid(), 'Synthetic.pdf', 'clinical', 'application/pdf', 8, repeat('a',64));
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Receptionist uploaded document'; end if;
  execute 'reset role';
  update public.users set is_active = false where id = actor;
  execute 'set local role authenticated';
  if exists (select 1 from public.clinical_documents) or exists (select 1 from storage.objects) then
    raise exception 'Inactive identity read documents';
  end if;
  blocked := false;
  begin perform public.record_document_access_request((document->>'id')::uuid);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Inactive identity requested access'; end if;
  execute 'reset role';
end;
$verify$;
rollback;
select 'PASS: private bucket controls, derived document ownership, request idempotency, patient/tenant isolation, role restrictions, reserved storage paths, object verification, immutable files and minimal audit. Metadata fixtures rolled back; physical Storage API delivery not exercised.' as verification;
