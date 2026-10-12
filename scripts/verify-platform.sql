begin;
do $verify$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  staff_a uuid := gen_random_uuid();
  staff_b uuid := gen_random_uuid();
  patients_a uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  patient_b uuid := gen_random_uuid();
  visits uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  clinic_today date := (now() at time zone 'Africa/Lagos')::date;
  q integer;
  affected integer;
  blocked boolean;
  i integer;
  baseline integer;
begin
  insert into public.organizations (id, name, slug)
    values (org_a, 'Temporary Sprint 7 verification A', 'verify-' || org_a),
           (org_b, 'Temporary Sprint 7 verification B', 'verify-' || org_b);

  insert into auth.users (id, email, aud, role, created_at, updated_at)
    values (staff_a, 'verify-' || staff_a || '@example.invalid', 'authenticated', 'authenticated', now(), now()),
           (staff_b, 'verify-' || staff_b || '@example.invalid', 'authenticated', 'authenticated', now(), now());

  insert into public.users (id, organization_id, full_name, email, role, is_active)
    values (staff_a, org_a, 'Temporary verification receptionist A', 'verify-' || staff_a || '@example.invalid', 'receptionist', true),
           (staff_b, org_b, 'Temporary verification receptionist B', 'verify-' || staff_b || '@example.invalid', 'receptionist', true);

  for i in 1..3 loop
    insert into public.patients (id, organization_id, hospital_number, first_name, last_name)
      values (patients_a[i], org_a, 'VERIFY-' || patients_a[i], 'Temporary', 'Verification');
  end loop;

  insert into public.patients (id, organization_id, hospital_number, first_name, last_name)
    values (patient_b, org_b, 'VERIFY-' || patient_b, 'Temporary', 'Verification');

  insert into public.appointments (id, patient_id, organization_id, appointment_date, created_by)
    values (visits[8], patient_b, org_b, clinic_today, staff_b);

  perform set_config('request.jwt.claim.sub', staff_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if current_user <> 'authenticated' then raise exception 'RLS test did not use authenticated role'; end if;

  for i in 1..6 loop
    insert into public.appointments (id, patient_id, organization_id, appointment_date, created_by)
      values (visits[i], patients_a[((i - 1) % 3) + 1], org_a, clinic_today, staff_a);
  end loop;

  insert into public.appointments (id, patient_id, organization_id, appointment_date, created_by)
    values (visits[7], patients_a[1], org_a, clinic_today + 1, staff_a);

  if exists (select 1 from public.appointments where id = any(visits[1:7]) and (status <> 'scheduled' or queue_number is not null)) then
    raise exception 'New bookings entered the queue';
  end if;

  select count(*) into baseline from public.appointments
    where organization_id = org_a and appointment_date = clinic_today and status <> 'cancelled';
  if baseline <> 6 then raise exception 'Today count incorrectly includes future/other clinic bookings'; end if;

  if exists (select 1 from public.appointments where id = visits[8]) then
    raise exception 'Another clinic appointment was visible';
  end if;
  if exists (select 1 from public.patients where id = patient_b) then
    raise exception 'Another clinic patient was visible';
  end if;

  update public.appointments set status = 'cancelled' where id = visits[8];
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-clinic update succeeded'; end if;

  blocked := false;
  begin
    perform public.check_in_appointment(visits[8]);
  exception when others then
    if sqlerrm = 'Appointment not found or not accessible' then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'Cross-clinic RPC was not blocked'; end if;

  blocked := false;
  begin
    insert into public.appointments (patient_id, organization_id, appointment_date, created_by)
      values (patient_b, org_b, clinic_today, staff_a);
  exception when insufficient_privilege or foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'Cross-clinic insert succeeded'; end if;

  blocked := false;
  begin
    insert into public.appointments (patient_id, organization_id, appointment_date, created_by)
      values (patient_b, org_a, clinic_today, staff_a);
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'Cross-clinic patient relationship accepted'; end if;

  blocked := false;
  begin
    perform public.check_in_appointment(visits[7]);
  exception when others then
    if sqlerrm = 'Only appointments scheduled for today can be checked in' then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'Future check-in succeeded'; end if;

  for i in 1..3 loop
    select queue_number into q from public.check_in_appointment(visits[i]);
    if q <> i then raise exception 'Queue numbering did not assign 1,2,3'; end if;
  end loop;
  select queue_number into q from public.check_in_appointment(visits[1]);
  if q <> 1 then raise exception 'Repeated check-in reassigned queue number'; end if;

  update public.appointments set status = 'in_consultation' where id = visits[1];
  update public.appointments set status = 'completed' where id = visits[1];
  if not exists (select 1 from public.appointments where id = visits[1] and status = 'completed' and queue_number = 1 and checked_in_at is not null and consultation_started_at is not null and completed_at is not null) then
    raise exception 'Completed visit lost its queue or lifecycle timestamps';
  end if;

  update public.appointments set status = 'cancelled' where id = visits[4];
  update public.appointments set status = 'cancelled' where id = visits[2];
  update public.appointments set status = 'in_consultation' where id = visits[3];
  update public.appointments set status = 'cancelled' where id = visits[3];

  if (select count(*) from public.appointments where id in (visits[4], visits[2], visits[3]) and status = 'cancelled' and cancelled_at is not null) <> 3 then
    raise exception 'Cancellation did not preserve all three visit records';
  end if;

  select count(*) into q from public.appointments
    where organization_id = org_a and appointment_date = clinic_today and status <> 'cancelled';
  if q <> 3 then raise exception 'Dashboard count did not exclude cancellations'; end if;

  blocked := false;
  begin
    update public.appointments set status = 'cancelled' where id = visits[1];
  exception when others then
    if sqlerrm = 'Completed or cancelled appointments are terminal' then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'Completed visit was not terminal'; end if;

  blocked := false;
  begin
    update public.appointments set status = 'scheduled' where id = visits[2];
  exception when others then
    if sqlerrm = 'Completed or cancelled appointments are terminal' then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'Cancelled visit was not terminal'; end if;

  blocked := false;
  begin
    update public.appointments set status = 'completed' where id = visits[5];
  exception when others then
    if sqlerrm = 'Invalid appointment status transition' then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'Invalid lifecycle transition succeeded'; end if;

  blocked := false;
  begin
    update public.appointments set queue_number = 1 where id = visits[5];
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate clinic queue number succeeded'; end if;

  perform set_config('request.jwt.claim.sub', staff_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', staff_b, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.appointments where organization_id = org_a) then
    raise exception 'Clinic B could see Clinic A visits';
  end if;
  select queue_number into q from public.check_in_appointment(visits[8]);
  if q <> 1 then raise exception 'Clinic B did not have an independent queue'; end if;


  -- Exercise the new clinical RLS and audit safeguards with the same temporary fixtures.
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', staff_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  blocked := false;
  begin
    insert into public.consultations(patient_id,organization_id,doctor_id,chief_complaint,diagnosis)
      values(patients_a[1],org_a,staff_a,'Synthetic test','Synthetic test');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Receptionist could write clinical consultations'; end if;
  execute 'reset role';
  update public.users set role='doctor' where id=staff_a;
  execute 'set local role authenticated';
  insert into public.consultations(patient_id,organization_id,doctor_id,chief_complaint,diagnosis)
    values(patients_a[1],org_a,staff_a,'Synthetic test','Synthetic test');
  insert into public.vitals(patient_id,organization_id,recorded_by,weight,height,bmi)
    values(patients_a[1],org_a,staff_a,70,170,24.2);
  blocked:=false;
  begin
    insert into public.consultations(patient_id,organization_id,doctor_id) values(patient_b,org_a,staff_a);
  exception when foreign_key_violation then blocked:=true;
  end;
  if not blocked then raise exception 'Clinical cross-clinic patient relationship was accepted'; end if;
  blocked:=false;
  begin
    insert into public.vitals(patient_id,organization_id,recorded_by) values(patients_a[1],org_a,staff_b);
  exception when insufficient_privilege or foreign_key_violation then blocked:=true;
  end;
  if not blocked then raise exception 'Spoofed clinical recorder was accepted'; end if;
  blocked:=false;
  begin
    insert into public.laboratory_results(patient_id,organization_id,recorded_by) values(patients_a[1],org_a,staff_a);
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Doctor could insert laboratory results'; end if;
  if exists(select 1 from public.audit_events where organization_id=org_a) then raise exception 'Non-admin could read audit events'; end if;
  blocked:=false;
  begin
    insert into public.audit_events(organization_id,entity_type,record_id,operation) values(org_a,'patients',patients_a[1],'INSERT');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Staff could forge audit events'; end if;
  execute 'reset role';
  update public.users set role='nurse' where id=staff_a;
  execute 'set local role authenticated';
  insert into public.vitals(patient_id,organization_id,recorded_by,weight,height) values(patients_a[1],org_a,staff_a,70,170);
  blocked:=false;
  begin
    insert into public.consultations(patient_id,organization_id,doctor_id) values(patients_a[1],org_a,staff_a);
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Nurse could create doctor consultations'; end if;
  execute 'reset role';
  update public.users set role='lab_scientist' where id=staff_a;
  execute 'set local role authenticated';
  insert into public.laboratory_results(patient_id,organization_id,recorded_by,hba1c) values(patients_a[1],org_a,staff_a,6);
  execute 'reset role';
  update public.users set role='organization_admin' where id=staff_a;
  execute 'set local role authenticated';
  if not exists(select 1 from public.audit_events where organization_id=org_a and entity_type='consultations') then raise exception 'Clinical insert did not generate an audit event'; end if;
  if exists(select 1 from public.audit_events where organization_id<>org_a) then raise exception 'Audit events leaked across clinics'; end if;
  if exists(select 1 from public.audit_events where details ? 'diagnosis' or details ? 'chief_complaint' or details ? 'hba1c') then raise exception 'Audit trail contains clinical values'; end if;
  blocked:=false;
  begin
    delete from public.audit_events where organization_id=org_a;
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Audit events could be deleted by a clinic admin'; end if;
  execute 'reset role';
  update public.users set is_active=false where id=staff_a;
  execute 'set local role authenticated';
  if exists(select 1 from public.patients where organization_id=org_a) or exists(select 1 from public.consultations where organization_id=org_a) or exists(select 1 from public.vitals where organization_id=org_a) or exists(select 1 from public.laboratory_results where organization_id=org_a) or exists(select 1 from public.audit_events where organization_id=org_a) then raise exception 'Inactive account retained clinical access'; end if;
  blocked:=false;
  begin
    insert into public.patients(organization_id,hospital_number,first_name,last_name) values(org_a,'VERIFY-'||gen_random_uuid(),'Inactive','Verification');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Inactive account could register a patient'; end if;
  execute 'reset role';

end;
$verify$;
rollback;
select 'PASS: queue workflow, tenant isolation, clinical role policies, clinical patient/actor boundaries, generated audit events, audit privacy and immutability, inactive-account access denial. All fixtures rolled back.' as verification;
