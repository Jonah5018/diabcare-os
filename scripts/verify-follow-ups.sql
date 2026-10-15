-- All synthetic clinics, users and care plans are removed by rollback.
begin;

do $verify$
declare
  clinic uuid := gen_random_uuid();
  foreign_clinic uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  colleague uuid := gen_random_uuid();
  foreign_actor uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  other_patient uuid := gen_random_uuid();
  foreign_patient uuid := gen_random_uuid();
  consultation uuid := gen_random_uuid();
  plan uuid;
  cancelled_plan uuid;
  foreign_plan uuid := gen_random_uuid();
  request uuid := gen_random_uuid();
  today date := (now() at time zone 'Africa/Lagos')::date;
  blocked boolean;
  row_count integer;
  due_cursor_date date;
  due_cursor_id uuid;
  entry record;
  visited integer := 0;
  page_count integer;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary synthetic follow-up clinic', 'verify-follow-up-' || clinic),
    (foreign_clinic, 'Temporary synthetic foreign clinic', 'verify-follow-up-' || foreign_clinic);
  insert into auth.users (id, email, aud, role) values
    (actor, actor || '@example.invalid', 'authenticated', 'authenticated'),
    (colleague, colleague || '@example.invalid', 'authenticated', 'authenticated'),
    (foreign_actor, foreign_actor || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (actor, clinic, 'Synthetic planning doctor', actor || '@example.invalid', 'doctor', true),
    (colleague, clinic, 'Synthetic colleague', colleague || '@example.invalid', 'doctor', true),
    (foreign_actor, foreign_clinic, 'Synthetic foreign doctor', foreign_actor || '@example.invalid', 'doctor', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name) values
    (patient, clinic, 'VERIFY-' || patient, 'Synthetic', 'Follow-up patient'),
    (other_patient, clinic, 'VERIFY-' || other_patient, 'Synthetic', 'Other patient'),
    (foreign_patient, foreign_clinic, 'VERIFY-' || foreign_patient, 'Synthetic', 'Foreign patient');
  insert into public.consultations (id, organization_id, patient_id, doctor_id)
  values (consultation, clinic, patient, actor);
  insert into public.follow_ups (id, organization_id, patient_id, created_by, request_id, request_fingerprint, due_date, reason)
  values (foreign_plan, foreign_clinic, foreign_patient, foreign_actor, gen_random_uuid(), 'test', today, 'Synthetic foreign plan');

  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  plan := public.create_follow_up(patient, consultation, today, 'SYNTHETIC-PRIVATE-REASON', request);
  if public.create_follow_up(patient, consultation, today, 'SYNTHETIC-PRIVATE-REASON', request) <> plan then
    raise exception 'Retry duplicated follow-up plan';
  end if;
  blocked := false;
  begin
    perform public.create_follow_up(patient, consultation, today, 'Changed reason', request);
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Request token reused for another payload'; end if;
  blocked := false;
  begin
    perform public.create_follow_up(other_patient, consultation, today, 'Synthetic', gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Cross-patient consultation accepted'; end if;
  blocked := false;
  begin
    perform public.create_follow_up(foreign_patient, null, today, 'Synthetic', gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Foreign patient accepted'; end if;
  blocked := false;
  begin
    perform public.create_follow_up(patient, null, today - 1, 'Synthetic', gen_random_uuid());
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Past-date new plan accepted'; end if;
  blocked := false;
  begin
    perform public.create_follow_up(patient, null, today, '  ', gen_random_uuid());
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Empty reason accepted'; end if;

  if exists (select 1 from public.follow_ups where id = foreign_plan) then raise exception 'Foreign clinic plan leaked'; end if;
  if exists (select 1 from public.get_patient_timeline(foreign_patient)) then raise exception 'Foreign timeline leaked'; end if;
  blocked := false;
  begin
    perform public.transition_follow_up(foreign_plan, 'completed');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Foreign clinic plan resolved'; end if;
  blocked := false;
  begin
    update public.follow_ups set organization_id = foreign_clinic where id = plan;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Direct plan write accepted'; end if;
  blocked := false;
  begin
    delete from public.follow_ups where id = plan;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Plan history deletion accepted'; end if;

  perform set_config('request.jwt.claim.sub', colleague::text, true);
  blocked := false;
  begin
    perform public.transition_follow_up(plan, 'completed');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Doctor resolved another doctor plan'; end if;
  execute 'reset role';
  update public.users set role = 'organization_admin' where id = colleague;
  execute 'set local role authenticated';
  perform public.transition_follow_up(plan, 'completed');
  perform public.transition_follow_up(plan, 'completed');
  blocked := false;
  begin
    perform public.transition_follow_up(plan, 'cancelled');
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Terminal plan overwritten'; end if;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  cancelled_plan := public.create_follow_up(patient, null, today + 1, 'Synthetic standalone', gen_random_uuid());
  perform public.transition_follow_up(cancelled_plan, 'cancelled');
  if (select count(*) from public.get_patient_timeline(patient) where event_kind like 'follow_up_%') <> 4 then
    raise exception 'Follow-up timeline milestones missing';
  end if;
  -- Audit review is privileged; doctors intentionally cannot read the audit feed.
  execute 'reset role';
  if exists (select 1 from public.audit_events where entity_type = 'follow_ups' and details::text like '%SYNTHETIC-PRIVATE-REASON%') then
    raise exception 'Audit exposed follow-up reason';
  end if;
  if not exists (select 1 from public.audit_events where record_id = plan and operation = 'UPDATE'
    and details ->> 'status' = 'completed' and details ->> 'previous_status' = 'planned') then
    raise exception 'Follow-up audit status metadata missing';
  end if;

  execute 'reset role';
  -- Historical overdue fixture validates computed recall classification.
  insert into public.follow_ups (organization_id, patient_id, created_by, request_id, request_fingerprint, due_date, reason)
  values (clinic, patient, actor, gen_random_uuid(), 'test', today - 1, 'Synthetic overdue plan');
  insert into public.follow_ups (organization_id, patient_id, created_by, request_id, request_fingerprint, due_date, reason)
  select clinic, patient, actor, gen_random_uuid(), 'test', today + 1, 'Synthetic equal-date plan'
  from generate_series(1, 60);
  execute 'set local role authenticated';
  select count(*) into row_count from public.follow_ups
  where organization_id = clinic and status = 'planned' and due_date < today;
  if row_count <> 1 then raise exception 'Overdue classification incorrect'; end if;
  select count(*) into row_count from public.follow_ups
  where organization_id = clinic and status = 'planned' and due_date >= today;
  if row_count <> 60 then raise exception 'Upcoming excludes/retains wrong status'; end if;
  loop
    page_count := 0;
    for entry in
      select id, due_date from public.follow_ups
      where organization_id = clinic and status = 'planned' and due_date >= today
        and (due_cursor_id is null or due_date > due_cursor_date
          or (due_date = due_cursor_date and id > due_cursor_id))
      order by due_date, id limit 25
    loop
      if due_cursor_id is not null and (entry.due_date, entry.id) <= (due_cursor_date, due_cursor_id) then
        raise exception 'Due-date pagination duplicated or reordered a plan';
      end if;
      due_cursor_date := entry.due_date;
      due_cursor_id := entry.id;
      visited := visited + 1;
      page_count := page_count + 1;
    end loop;
    exit when page_count = 0;
    if visited > 60 then raise exception 'Due-date pagination did not terminate'; end if;
  end loop;
  if visited <> 60 then raise exception 'Due-date pagination lost plans'; end if;
  if exists (select 1 from public.appointments where organization_id = clinic)
     or (select count(*) from public.consultations where organization_id = clinic) <> 1 then
    raise exception 'Follow-up handling modified independent appointment/consultation data';
  end if;

  execute 'reset role';
  update public.users set role = 'receptionist' where id = actor;
  execute 'set local role authenticated';
  if not exists (select 1 from public.follow_ups where id = plan) then raise exception 'Staff clinical read lost'; end if;
  blocked := false;
  begin
    perform public.create_follow_up(patient, null, today, 'Synthetic', gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Receptionist authored clinical follow-up'; end if;
  execute 'reset role';
  update public.users set is_active = false where id = actor;
  execute 'set local role authenticated';
  if exists (select 1 from public.follow_ups) then raise exception 'Inactive user read plans'; end if;
  blocked := false;
  begin
    perform public.transition_follow_up(plan, 'completed');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Inactive user resolved plan'; end if;
  execute 'reset role';
  execute 'set local role anon';
  blocked := false;
  begin
    perform public.create_follow_up(patient, null, today, 'Synthetic', gen_random_uuid());
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous planning allowed'; end if;
  execute 'reset role';
end;
$verify$;

rollback;
select 'PASS: follow-up idempotency, patient/clinic boundaries, clinical author restrictions, terminal handling, metadata-only audit, recall/upcoming classification, timeline events, read-only direct grants, inactive/anonymous denial. All fixtures rolled back.' as verification;
