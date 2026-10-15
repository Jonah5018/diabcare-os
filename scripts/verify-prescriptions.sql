-- Synthetic fixtures only. Nothing survives this transaction.
begin;

do $verify$
#variable_conflict use_column
<<verify>>
declare
  clinic_a uuid := gen_random_uuid();
  clinic_b uuid := gen_random_uuid();
  doctor_a uuid := gen_random_uuid();
  doctor_b uuid := gen_random_uuid();
  colleague uuid := gen_random_uuid();
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  consultation_a uuid := gen_random_uuid();
  consultation_b uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  prescription_id uuid;
  second_id uuid;
  baseline integer;
  blocked boolean;
  denied_role text;
  medication jsonb := '[{"medication_name":"Synthetic medication","strength":"Test strength","dose":"Test dose","frequency":"Test frequency","route":"","duration":"Test duration","instructions":"Synthetic instructions"}]';
begin
  insert into public.organizations (id, name, slug) values
    (clinic_a, 'Temporary prescription clinic A', 'verify-rx-' || clinic_a),
    (clinic_b, 'Temporary prescription clinic B', 'verify-rx-' || clinic_b);

  insert into auth.users (id, email, aud, role) values
    (doctor_a, 'verify-rx-' || doctor_a || '@example.invalid', 'authenticated', 'authenticated'),
    (doctor_b, 'verify-rx-' || doctor_b || '@example.invalid', 'authenticated', 'authenticated'),
    (colleague, 'verify-rx-' || colleague || '@example.invalid', 'authenticated', 'authenticated');

  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (doctor_a, clinic_a, 'Synthetic prescriber A', 'verify-rx-' || doctor_a || '@example.invalid', 'doctor', true),
    (doctor_b, clinic_b, 'Synthetic prescriber B', 'verify-rx-' || doctor_b || '@example.invalid', 'doctor', true),
    (colleague, clinic_a, 'Synthetic colleague', 'verify-rx-' || colleague || '@example.invalid', 'doctor', true);

  insert into public.patients (id, organization_id, hospital_number, first_name, last_name) values
    (patient_a, clinic_a, 'VERIFY-RX-' || patient_a, 'Synthetic', 'Patient A'),
    (patient_b, clinic_b, 'VERIFY-RX-' || patient_b, 'Synthetic', 'Patient B');
  insert into public.consultations (id, patient_id, organization_id, doctor_id) values
    (consultation_a, patient_a, clinic_a, doctor_a),
    (consultation_b, patient_b, clinic_b, doctor_b);

  perform set_config('request.jwt.claim.sub', doctor_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', doctor_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  prescription_id := public.create_prescription(patient_a, consultation_a, current_date, medication, request_id);
  if not exists (
    select 1 from public.prescriptions where id = prescription_id
      and prescriber_id = doctor_a and organization_id = clinic_a and patient_id = patient_a
  ) then raise exception 'Prescriber or clinic was not derived from authenticated identity'; end if;
  if (select count(*) from public.prescription_items where prescription_id = verify.prescription_id) <> 1 then
    raise exception 'Structured medication missing';
  end if;
  if public.create_prescription(patient_a, consultation_a, current_date, medication, request_id) <> prescription_id then
    raise exception 'Retry duplicated prescription';
  end if;

  blocked := false;
  begin
    perform public.create_prescription(patient_a, consultation_a, current_date, medication || medication, request_id);
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Changed retry payload accepted'; end if;

  blocked := false;
  begin
    perform public.create_prescription(patient_b, consultation_b, current_date, medication, gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Cross-clinic consultation accepted'; end if;

  blocked := false;
  begin
    perform public.create_prescription(patient_b, consultation_a, current_date, medication, gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Wrong consultation patient accepted'; end if;

  select count(*) into baseline from public.prescriptions;
  blocked := false;
  begin
    perform public.create_prescription(patient_a, consultation_a, current_date,
      jsonb_set(medication, '{0,dose}', '" "'), gen_random_uuid());
  exception when check_violation then blocked := true;
  end;
  if not blocked or (select count(*) from public.prescriptions) <> baseline then
    raise exception 'Failed item left a partial prescription';
  end if;

  blocked := false;
  begin
    perform public.create_prescription(patient_a, consultation_a, current_date, '[]', gen_random_uuid());
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Empty prescription accepted'; end if;

  blocked := false;
  begin
    update public.prescriptions set patient_id = patient_b where id = prescription_id;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Direct header modification accepted'; end if;
  blocked := false;
  begin
    delete from public.prescription_items where prescription_id = verify.prescription_id;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Medication deletion accepted'; end if;

  blocked := false;
  begin
    insert into public.prescriptions (
      organization_id, patient_id, prescriber_id, consultation_id,
      prescribed_date, request_id, request_fingerprint
    ) values (clinic_a, patient_a, colleague, consultation_a, current_date, gen_random_uuid(), 'forged');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Direct insert with forged prescriber accepted'; end if;
  blocked := false;
  begin
    delete from public.prescriptions where id = prescription_id;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Direct header deletion accepted'; end if;
  blocked := false;
  begin
    update public.prescription_items set dose = 'forged' where prescription_id = verify.prescription_id;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Medication edit accepted'; end if;

  perform public.transition_prescription(prescription_id, 'completed');
  perform public.transition_prescription(prescription_id, 'completed');
  blocked := false;
  begin
    perform public.transition_prescription(prescription_id, 'cancelled');
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Terminal status changed'; end if;

  second_id := public.create_prescription(patient_a, consultation_a, current_date, medication, gen_random_uuid());
  execute 'reset role';

  if exists (
    select 1 from public.audit_events where organization_id = clinic_a
      and entity_type in ('prescriptions', 'prescription_items')
      and (details::text like '%Synthetic%' or details::text like '%dose%' or details::text like '%fingerprint%')
  ) then raise exception 'Clinical contents leaked into audit'; end if;
  if not exists (
    select 1 from public.audit_events where record_id = prescription_id
      and details = '{"status":"completed","previous_status":"active"}'::jsonb
  ) then raise exception 'Prescription transition audit missing'; end if;

  perform set_config('request.jwt.claim.sub', doctor_b::text, true);
  execute 'set local role authenticated';
  if exists (select 1 from public.prescriptions where id = prescription_id)
     or exists (select 1 from public.prescription_items where prescription_id = verify.prescription_id) then
    raise exception 'Cross-clinic prescription readable';
  end if;
  blocked := false;
  begin
    perform public.transition_prescription(second_id, 'cancelled');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Cross-clinic transition accepted'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', colleague::text, true);
  execute 'set local role authenticated';
  blocked := false;
  begin
    perform public.transition_prescription(second_id, 'cancelled');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Doctor changed another prescriber record'; end if;
  execute 'reset role';

  update public.users set role = 'organization_admin' where id = colleague;
  execute 'set local role authenticated';
  perform public.transition_prescription(second_id, 'cancelled');
  perform public.create_prescription(patient_a, consultation_a, current_date, medication, gen_random_uuid());
  execute 'reset role';

  foreach denied_role in array array['receptionist', 'nurse', 'lab_scientist'] loop
    update public.users set role = denied_role::public.user_role where id = colleague;
    execute 'set local role authenticated';
    blocked := false;
    begin
      perform public.create_prescription(patient_a, consultation_a, current_date, medication, gen_random_uuid());
    exception when insufficient_privilege then blocked := true;
    end;
    if not blocked then raise exception 'Unauthorised role prescribed'; end if;
    execute 'reset role';
  end loop;

  update public.users set role = 'doctor', is_active = false where id = colleague;
  execute 'set local role authenticated';
  if exists (select 1 from public.prescriptions) then raise exception 'Inactive staff read prescriptions'; end if;
  blocked := false;
  begin
    perform public.create_prescription(patient_a, consultation_a, current_date, medication, gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Inactive staff prescribed'; end if;
  execute 'reset role';

  execute 'set local role anon';
  blocked := false;
  begin
    perform public.create_prescription(patient_a, consultation_a, current_date, medication, gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous prescribing allowed'; end if;
  execute 'reset role';
end;
$verify$;

rollback;
select 'PASS: atomic structured prescriptions, idempotency, clinic/patient boundaries, role restrictions, terminal states, immutable items, audit privacy, inactive and anonymous denial. All fixtures rolled back.' as verification;
