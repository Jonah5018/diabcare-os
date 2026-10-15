begin;

do $verify$
declare
  clinic uuid := gen_random_uuid();
  staff uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  other_patient uuid := gen_random_uuid();
  visit uuid := gen_random_uuid();
  completed_visit uuid := gen_random_uuid();
  foreign_clinic uuid := gen_random_uuid();
  foreign_staff uuid := gen_random_uuid();
  foreign_patient uuid := gen_random_uuid();
  foreign_visit uuid := gen_random_uuid();
  consultation uuid;
  blocked boolean;
begin
  insert into public.organizations (id, name, slug)
  values (clinic, 'Temporary linked visit clinic', 'verify-visit-' || clinic);
  insert into public.organizations (id, name, slug)
  values (foreign_clinic, 'Temporary foreign visit clinic', 'verify-visit-' || foreign_clinic);
  insert into auth.users (id, email, aud, role)
  values (foreign_staff, 'verify-visit-' || foreign_staff || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active)
  values (foreign_staff, foreign_clinic, 'Synthetic foreign author', 'verify-visit-' || foreign_staff || '@example.invalid', 'doctor', true);
  insert into auth.users (id, email, aud, role)
  values (staff, 'verify-visit-' || staff || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active)
  values (staff, clinic, 'Synthetic visit author', 'verify-visit-' || staff || '@example.invalid', 'platform_owner', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name) values
    (patient, clinic, 'VERIFY-VISIT-' || patient, 'Synthetic', 'Visit patient'),
    (other_patient, clinic, 'VERIFY-VISIT-' || other_patient, 'Synthetic', 'Other patient');
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name)
  values (foreign_patient, foreign_clinic, 'VERIFY-VISIT-' || foreign_patient, 'Synthetic', 'Foreign patient');
  insert into public.appointments (id, organization_id, patient_id, created_by, appointment_date)
  values (foreign_visit, foreign_clinic, foreign_patient, foreign_staff, (now() at time zone 'Africa/Lagos')::date);

  perform set_config('request.jwt.claim.sub', staff::text, true);
  execute 'set local role authenticated';
  insert into public.appointments (id, organization_id, patient_id, created_by, appointment_date) values
    (visit, clinic, patient, staff, (now() at time zone 'Africa/Lagos')::date),
    (completed_visit, clinic, patient, staff, (now() at time zone 'Africa/Lagos')::date);

  blocked := false;
  begin
    insert into public.consultations (organization_id, patient_id, doctor_id, appointment_id)
    values (clinic, patient, staff, visit);
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Scheduled visit accepted clinical linkage'; end if;

  perform public.check_in_appointment(visit);
  blocked := false;
  begin
    insert into public.consultations (organization_id, patient_id, doctor_id, appointment_id)
    values (clinic, patient, staff, foreign_visit);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Cross-clinic visit linkage accepted'; end if;
  blocked := false;
  begin
    insert into public.consultations (organization_id, patient_id, doctor_id, appointment_id)
    values (clinic, other_patient, staff, visit);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Wrong patient linked to visit'; end if;

  insert into public.consultations (organization_id, patient_id, doctor_id, appointment_id)
  values (clinic, patient, staff, visit) returning id into consultation;
  perform public.check_in_appointment(completed_visit);

  blocked := false;
  begin
    insert into public.vitals (
      organization_id, patient_id, recorded_by, appointment_id, consultation_id
    ) values (clinic, patient, staff, completed_visit, consultation);
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'Vitals linked consultation and appointment from different visits'; end if;

  insert into public.vitals (
    organization_id, patient_id, recorded_by, appointment_id, consultation_id
  ) values (clinic, patient, staff, visit, consultation);

  blocked := false;
  begin
    insert into public.laboratory_results (organization_id, patient_id, recorded_by, appointment_id)
    values (clinic, other_patient, staff, visit);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked or not exists (select 1 from public.consultations where id = consultation) then
    raise exception 'Failed laboratory save corrupted consultation history';
  end if;

  blocked := false;
  begin
    perform public.create_prescription(patient, consultation, current_date,
      '[{"medication_name":"Synthetic","strength":"Test","dose":" ","frequency":"Test","route":"","duration":"Test","instructions":""}]',
      gen_random_uuid());
  exception when check_violation then blocked := true;
  end;
  if not blocked or not exists (select 1 from public.appointments where id = visit and status = 'waiting')
     or not exists (select 1 from public.consultations where id = consultation) then
    raise exception 'Failed prescription corrupted appointment or consultation';
  end if;
  insert into public.vitals (organization_id, patient_id, recorded_by, appointment_id)
  values (clinic, patient, staff, visit);
  insert into public.laboratory_results (organization_id, patient_id, recorded_by, appointment_id)
  values (clinic, patient, staff, visit);

  execute 'reset role';
  update public.users set role = 'lab_scientist' where id = staff;
  execute 'set local role authenticated';
  insert into public.laboratory_results (organization_id, patient_id, recorded_by, appointment_id)
  values (clinic, patient, staff, visit);
  execute 'reset role';
  update public.users set role = 'nurse' where id = staff;
  execute 'set local role authenticated';
  insert into public.vitals (organization_id, patient_id, recorded_by, appointment_id)
  values (clinic, patient, staff, visit);
  execute 'reset role';
  update public.users set role = 'platform_owner' where id = staff;
  execute 'set local role authenticated';

  update public.appointments set status = 'cancelled' where id = visit;
  if not exists (select 1 from public.consultations where id = consultation and appointment_id = visit) then
    raise exception 'Cancellation corrupted clinical history';
  end if;
  blocked := false;
  begin
    insert into public.vitals (organization_id, patient_id, recorded_by, appointment_id)
    values (clinic, patient, staff, visit);
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Cancelled visit accepted a new linked record'; end if;

  perform public.check_in_appointment(completed_visit);
  update public.appointments set status = 'in_consultation' where id = completed_visit;
  update public.appointments set status = 'completed' where id = completed_visit;
  -- Missing records do not prevent completion; late documentation remains valid.
  insert into public.consultations (organization_id, patient_id, doctor_id, appointment_id)
  values (clinic, patient, staff, completed_visit);
  insert into public.consultations (organization_id, patient_id, doctor_id)
  values (clinic, patient, staff);

  execute 'reset role';
end;
$verify$;

rollback;
select 'PASS: visit-linked clinical records, same-visit consultation/vitals consistency, check-in gate, patient isolation, retained cancellation history, independent completion, late documentation and legacy unlinked records. All fixtures rolled back.' as verification;
