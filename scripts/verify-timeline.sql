-- Fixtures exist only in this transaction; no existing account is reassigned.
begin;

do $verify$
declare
  clinic uuid := gen_random_uuid();
  foreign_clinic uuid := gen_random_uuid();
  staff uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  other_patient uuid := gen_random_uuid();
  foreign_patient uuid := gen_random_uuid();
  visit uuid := gen_random_uuid();
  cancelled_visit uuid := gen_random_uuid();
  consultation uuid;
  prescription uuid;
  cursor_time timestamptz;
  cursor_kind text;
  cursor_id uuid;
  entry record;
  seen text[] := '{}';
  page_count integer;
  expected_count integer;
  blocked boolean;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary synthetic timeline clinic', 'verify-timeline-' || clinic),
    (foreign_clinic, 'Temporary synthetic foreign clinic', 'verify-timeline-' || foreign_clinic);
  insert into auth.users (id, email, aud, role)
  values (staff, 'verify-timeline-' || staff || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active)
  values (staff, clinic, 'Synthetic timeline author', 'verify-timeline-' || staff || '@example.invalid', 'platform_owner', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name) values
    (patient, clinic, 'VERIFY-' || patient, 'Synthetic', 'Timeline patient'),
    (other_patient, clinic, 'VERIFY-' || other_patient, 'Synthetic', 'Other patient'),
    (foreign_patient, foreign_clinic, 'VERIFY-' || foreign_patient, 'Synthetic', 'Foreign patient');
  -- Legacy unknown timestamps must stay unknown rather than becoming today's date.
  insert into public.consultations (organization_id, patient_id, doctor_id, visit_date, created_at)
  values (clinic, patient, staff, null, null);
  insert into public.consultations (organization_id, patient_id, doctor_id)
  values (clinic, other_patient, staff);

  perform set_config('request.jwt.claim.sub', staff::text, true);
  execute 'set local role authenticated';
  insert into public.appointments (id, organization_id, patient_id, created_by, appointment_date) values
    (visit, clinic, patient, staff, (now() at time zone 'Africa/Lagos')::date),
    (cancelled_visit, clinic, patient, staff, (now() at time zone 'Africa/Lagos')::date);
  perform public.check_in_appointment(visit);
  update public.appointments set status = 'in_consultation' where id = visit;
  insert into public.consultations (organization_id, patient_id, doctor_id, appointment_id)
  values (clinic, patient, staff, visit) returning id into consultation;
  insert into public.vitals (organization_id, patient_id, recorded_by, appointment_id)
  values (clinic, patient, staff, visit);
  insert into public.laboratory_results (organization_id, patient_id, recorded_by, appointment_id)
  values (clinic, patient, staff, visit);
  prescription := public.create_prescription(patient, consultation, current_date,
    '[{"medication_name":"Synthetic test only","strength":"Test","dose":"Test","frequency":"Test","route":"","duration":"Test","instructions":""}]',
    gen_random_uuid());
  perform public.transition_prescription(prescription, 'completed');
  prescription := public.create_prescription(patient, consultation, current_date,
    '[{"medication_name":"Synthetic test only","strength":"Test","dose":"Test","frequency":"Test","route":"","duration":"Test","instructions":""}]',
    gen_random_uuid());
  perform public.transition_prescription(prescription, 'cancelled');
  update public.appointments set status = 'completed' where id = visit;
  update public.appointments set status = 'cancelled' where id = cancelled_visit;

  -- Enough equal-time events to cross multiple pages; retain submillisecond precision.
  insert into public.consultations (organization_id, patient_id, doctor_id, visit_date, created_at)
  select clinic, patient, staff, '2020-01-01T10:00:00.123456Z'::timestamptz, now()
  from generate_series(1, 60);

  if (select count(distinct event_kind) from public.patient_timeline_events where patient_id = patient) <> 11 then
    raise exception 'Timeline omitted an implemented event kind';
  end if;
  if (select count(*) from public.get_patient_timeline(patient, p_limit => 100000)) <> 26 then
    raise exception 'Timeline limit not bounded';
  end if;
  if exists (select 1 from public.get_patient_timeline(foreign_patient)) then
    raise exception 'Timeline leaked foreign clinic';
  end if;
  if exists (select 1 from public.get_patient_timeline(patient) where patient_id <> patient or organization_id <> clinic) then
    raise exception 'Timeline leaked another patient';
  end if;

  select count(*) into expected_count from public.patient_timeline_events where patient_id = patient;
  loop
    page_count := 0;
    for entry in select * from public.get_patient_timeline(patient, cursor_time, cursor_kind, cursor_id, 25)
    loop
      if entry.event_kind || ':' || entry.source_id = any(seen) then
        raise exception 'Timeline duplicated an event across pages';
      end if;
      if cursor_id is not null and (
        (cursor_time is null and entry.occurred_at is not null)
        or (cursor_time is not null and entry.occurred_at > cursor_time)
        or (entry.occurred_at is not distinct from cursor_time
          and (entry.event_kind collate "C", entry.source_id) >= (cursor_kind collate "C", cursor_id))
      ) then
        raise exception 'Timeline order changed across pages';
      end if;
      seen := array_append(seen, entry.event_kind || ':' || entry.source_id);
      cursor_time := entry.occurred_at;
      cursor_kind := entry.event_kind;
      cursor_id := entry.source_id;
      page_count := page_count + 1;
    end loop;
    exit when page_count = 0;
    if cardinality(seen) > expected_count then raise exception 'Timeline did not terminate'; end if;
  end loop;
  if cardinality(seen) <> expected_count or cursor_time is not null then
    raise exception 'Timeline lost events or undated legacy record';
  end if;

  blocked := false;
  begin
    perform public.get_patient_timeline(patient, null, 'invalid', gen_random_uuid());
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Invalid timeline cursor accepted'; end if;
  blocked := false;
  begin
    delete from public.patient_timeline_events where patient_id = patient;
  exception when insufficient_privilege or object_not_in_prerequisite_state then blocked := true;
  end;
  if not blocked then raise exception 'Timeline unexpectedly writable'; end if;

  execute 'reset role';
  update public.users set role = 'receptionist' where id = staff;
  execute 'set local role authenticated';
  if not exists (select 1 from public.get_patient_timeline(patient)) then
    raise exception 'Existing clinical read capability lost';
  end if;
  execute 'reset role';
  update public.users set is_active = false where id = staff;
  execute 'set local role authenticated';
  if exists (select 1 from public.get_patient_timeline(patient)) then
    raise exception 'Inactive staff read timeline';
  end if;
  execute 'reset role';
  execute 'set local role anon';
  blocked := false;
  begin
    perform public.get_patient_timeline(patient);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous timeline execution allowed'; end if;
  execute 'reset role';
end;
$verify$;

rollback;
select 'PASS: eleven event kinds, bounded pages, stable equal-time/UUID and null-time cursors, no gaps/duplicates, patient/tenant isolation, existing read roles, inactive/anonymous rejection, read-only view. All fixtures rolled back.' as verification;
