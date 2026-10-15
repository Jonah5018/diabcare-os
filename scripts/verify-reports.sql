begin;
do $verify$
declare
  clinic uuid := gen_random_uuid();
  foreign_clinic uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  second_patient uuid := gen_random_uuid();
  foreign_patient uuid := gen_random_uuid();
  appointment uuid := gen_random_uuid();
  cancelled uuid := gen_random_uuid();
  consultation uuid;
  today date := (now() at time zone 'Africa/Lagos')::date;
  end_time timestamptz := (today + 1)::timestamp at time zone 'Africa/Lagos';
  result jsonb;
  blocked boolean;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary report clinic', 'verify-report-' || clinic),
    (foreign_clinic, 'Temporary foreign report clinic', 'verify-report-' || foreign_clinic);
  insert into auth.users (id, email, aud, role) values (actor, actor || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active)
  values (actor, clinic, 'Synthetic report actor', actor || '@example.invalid', 'platform_owner', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name) values
    (patient, clinic, 'VERIFY-' || patient, 'Synthetic', 'Patient'),
    (second_patient, clinic, 'VERIFY-' || second_patient, 'Synthetic', 'Cancelled patient'),
    (foreign_patient, foreign_clinic, 'VERIFY-' || foreign_patient, 'Synthetic', 'Foreign patient');
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  insert into public.appointments (id, organization_id, patient_id, created_by, appointment_date) values
    (appointment, clinic, patient, actor, today),
    (cancelled, clinic, second_patient, actor, today);
  perform public.check_in_appointment(appointment);
  update public.appointments set status = 'in_consultation' where id = appointment;
  update public.appointments set status = 'completed' where id = appointment;
  update public.appointments set status = 'cancelled' where id = cancelled;
  insert into public.consultations (organization_id, patient_id, doctor_id)
  values (clinic, patient, actor) returning id into consultation;
  insert into public.consultations (organization_id, patient_id, doctor_id, visit_date, created_at)
  values (clinic, patient, actor, null, null);
  insert into public.vitals (organization_id, patient_id, recorded_by, created_at) values
    (clinic, patient, actor, now()), (clinic, patient, actor, now()),
    (clinic, patient, actor, end_time);
  insert into public.laboratory_results (organization_id, patient_id, recorded_by)
  values (clinic, patient, actor);
  perform public.create_prescription(patient, consultation, today,
    '[{"medication_name":"Synthetic","strength":"Test","dose":"Test","frequency":"Test","route":"","duration":"Test","instructions":""}]', gen_random_uuid());
  execute 'reset role';
  insert into public.follow_ups (organization_id, patient_id, created_by, request_id, request_fingerprint, due_date, reason)
  values (clinic, patient, actor, gen_random_uuid(), 'synthetic', today - 1, 'Synthetic overdue');
  execute 'set local role authenticated';
  result := public.get_clinic_operational_report(today - 1, today);
  if (result ->> 'registrations')::int <> 2 or (result ->> 'bookings')::int <> 2
     or (result ->> 'non_cancelled')::int <> 1 or (result ->> 'completed')::int <> 1
     or (result ->> 'cancelled')::int <> 1 or (result ->> 'check_ins')::int <> 1
     or (result ->> 'consultations')::int <> 1 or (result ->> 'vitals')::int <> 2
     or (result ->> 'prescriptions')::int <> 1 or (result ->> 'follow_ups_overdue')::int <> 1
     or (result ->> 'cohort_patients')::int <> 1 or (result ->> 'cohort_with_vitals')::int <> 1
     or (result ->> 'cohort_with_labs')::int <> 1 then
    raise exception 'Report counts, bounds, legacy timestamps or distinct patient coverage incorrect';
  end if;
  blocked := false;
  begin
    perform public.get_clinic_operational_report(today - 31, today);
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Unbounded report accepted'; end if;
  execute 'reset role';
  update public.users set role = 'doctor' where id = actor;
  execute 'set local role authenticated';
  perform public.get_clinic_operational_report(today, today);
  execute 'reset role';
  update public.users set role = 'receptionist' where id = actor;
  execute 'set local role authenticated';
  blocked := false;
  begin
    perform public.get_clinic_operational_report(today, today);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Unauthorized report read allowed'; end if;
  execute 'reset role';
  update public.users set role = 'doctor', is_active = false where id = actor;
  execute 'set local role authenticated';
  blocked := false;
  begin
    perform public.get_clinic_operational_report(today, today);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Inactive report read allowed'; end if;
  execute 'reset role';
end;
$verify$;
rollback;
select 'PASS: bounded tenant report aggregates, lifecycle/queue/prescription/follow-up counts, timezone/end bounds, unknown timestamps, distinct recording coverage and report roles. Fixtures rolled back.' as verification;
