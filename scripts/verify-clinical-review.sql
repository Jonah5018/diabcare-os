-- Temporary synthetic fixtures, including Auth identities, never persist.
-- Application capability denial is tested in verify-clinical-review.cjs.
-- Existing same-clinic raw record read policies are deliberately preserved.
begin;
set local statement_timeout = '15s';

do $verify$
#variable_conflict use_column
<<verify>>
declare
  clinic_a uuid := gen_random_uuid();
  clinic_b uuid := gen_random_uuid();
  actor_a uuid := gen_random_uuid();
  actor_b uuid := gen_random_uuid();
  patient_a uuid := gen_random_uuid();
  patient_b uuid := gen_random_uuid();
  sibling uuid := gen_random_uuid();
  consultation_a uuid := gen_random_uuid();
  consultation_b uuid := gen_random_uuid();
  prescription_a uuid := gen_random_uuid();
  prescription_b uuid := gen_random_uuid();
  today date := (now() at time zone 'Africa/Lagos')::date;
  source_table text;
  actor_role text;
  observed integer;
begin
  insert into public.organizations (id, name, slug) values
    (clinic_a, 'Temporary synthetic review A', 'verify-review-' || clinic_a),
    (clinic_b, 'Temporary synthetic review B', 'verify-review-' || clinic_b);
  insert into auth.users (id, email, aud, role) values
    (actor_a, actor_a || '@example.invalid', 'authenticated', 'authenticated'),
    (actor_b, actor_b || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (actor_a, clinic_a, 'Synthetic review doctor', actor_a || '@example.invalid', 'doctor', true),
    (actor_b, clinic_b, 'Synthetic foreign doctor', actor_b || '@example.invalid', 'doctor', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name) values
    (patient_a, clinic_a, 'VERIFY-' || patient_a, 'Synthetic', 'Review patient'),
    (sibling, clinic_a, 'VERIFY-' || sibling, 'Synthetic', 'Other patient'),
    (patient_b, clinic_b, 'VERIFY-' || patient_b, 'Synthetic', 'Foreign patient');

  -- Enough records for the twelve-record preview plus lookahead, and a
  -- missing-date source that must remain available in the original history.
  insert into public.vitals (organization_id, patient_id, recorded_by, created_at, weight, fasting_blood_sugar)
  select clinic_a, patient_a, actor_a, now() - make_interval(days => n), 60 + n, 5.1
  from generate_series(1, 15) n;
  insert into public.vitals (organization_id, patient_id, recorded_by, created_at, weight)
  values (clinic_a, patient_a, actor_a, null, null),
    (clinic_a, sibling, actor_a, now(), 90),
    (clinic_b, patient_b, actor_b, now(), 70);
  insert into public.laboratory_results (organization_id, patient_id, recorded_by, created_at, hba1c, creatinine)
  select clinic_a, patient_a, actor_a, now() - make_interval(days => n), 6 + n / 10.0, null
  from generate_series(1, 15) n;
  insert into public.laboratory_results (organization_id, patient_id, recorded_by, created_at)
  values (clinic_a, patient_a, actor_a, null), (clinic_b, patient_b, actor_b, now());
  insert into public.consultations (id, organization_id, patient_id, doctor_id, chief_complaint)
  values (consultation_a, clinic_a, patient_a, actor_a, 'Synthetic source entry'),
    (consultation_b, clinic_b, patient_b, actor_b, 'Synthetic foreign source');
  insert into public.appointments (organization_id, patient_id, created_by, appointment_date)
  select clinic_a, patient_a, actor_a, today - n from generate_series(0, 6) n;
  insert into public.appointments (organization_id, patient_id, created_by, appointment_date)
  values (clinic_a, patient_a, actor_a, today + 10), (clinic_b, patient_b, actor_b, today);

  insert into public.prescriptions (
    id, organization_id, patient_id, prescriber_id, consultation_id,
    request_id, request_fingerprint, prescribed_date
  ) values
    (prescription_a, clinic_a, patient_a, actor_a, consultation_a, gen_random_uuid(), 'synthetic', today),
    (prescription_b, clinic_b, patient_b, actor_b, consultation_b, gen_random_uuid(), 'synthetic', today);
  insert into public.prescription_items (
    organization_id, prescription_id, position, medication_name, strength, dose, frequency, duration
  ) values
    (clinic_a, prescription_a, 1, 'Synthetic item A', 'Test', 'Test', 'Test', 'Test'),
    (clinic_b, prescription_b, 1, 'Synthetic item B', 'Test', 'Test', 'Test', 'Test');
  insert into public.follow_ups (
    organization_id, patient_id, created_by, request_id, request_fingerprint, due_date, reason
  ) values
    (clinic_a, patient_a, actor_a, gen_random_uuid(), 'synthetic', today - 1, 'Synthetic overdue plan'),
    (clinic_a, patient_a, actor_a, gen_random_uuid(), 'synthetic', today, 'Synthetic due today'),
    (clinic_b, patient_b, actor_b, gen_random_uuid(), 'synthetic', today - 1, 'Synthetic foreign plan');

  perform set_config('request.jwt.claim.sub', actor_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into observed from (
    select id from public.vitals
    where organization_id = clinic_a and patient_id = patient_a
    order by created_at desc nulls last, id desc limit 13
  ) bounded;
  if observed <> 13 then raise exception 'Vitals preview lookahead failed'; end if;
  select count(*) into observed from (
    select id from public.laboratory_results
    where organization_id = clinic_a and patient_id = patient_a
    order by created_at desc nulls last, id desc limit 13
  ) bounded;
  if observed <> 13 then raise exception 'Laboratory preview lookahead failed'; end if;
  if (select count(*) from public.vitals where patient_id = patient_a) <> 16
    or not exists (select 1 from public.vitals where patient_id = patient_a and created_at is null and weight is null)
    or not exists (select 1 from public.laboratory_results where patient_id = patient_a and created_at is null and hba1c is null) then
    raise exception 'Source history or missing values were lost';
  end if;
  if (select count(*) from public.appointments where patient_id = patient_a and appointment_date <= today) <> 7 then
    raise exception 'Recent appointment date filter failed';
  end if;
  if (select count(*) from public.follow_ups where patient_id = patient_a and status = 'planned' and due_date < today) <> 1 then
    raise exception 'Defined overdue planning rule failed';
  end if;
  if (select count(*) from public.prescription_items where prescription_id = prescription_a) <> 1 then
    raise exception 'Structured source items missing';
  end if;

  -- RLS must hold even when an application accidentally omits its clinic filter.
  foreach source_table in array array[
    'patients', 'vitals', 'laboratory_results', 'consultations',
    'appointments', 'prescriptions', 'prescription_items', 'follow_ups'
  ] loop
    execute format('select count(*) from public.%I where organization_id = $1', source_table)
      into observed using clinic_b;
    if observed <> 0 then raise exception 'Foreign source exposed: %', source_table; end if;
  end loop;
  execute 'reset role';

  -- Owner authority for global metadata must not become global clinical read.
  foreach actor_role in array array['organization_admin', 'platform_owner'] loop
    update public.users set role = actor_role::public.user_role where id = actor_a;
    execute 'set local role authenticated';
    if exists (select 1 from public.patients where id = patient_b)
      or exists (select 1 from public.prescription_items where prescription_id = prescription_b) then
      raise exception 'Privileged clinic role leaked foreign clinical source';
    end if;
    if not exists (select 1 from public.patients where id = patient_a) then
      raise exception 'Assigned clinic source unavailable';
    end if;
    execute 'reset role';
  end loop;
end;
$verify$;

rollback;
select 'PASS: bounded source previews, retained missing data/history, recent-date and overdue-plan rules, structured medication sources, doctor/admin/owner tenant isolation. All fixtures rolled back.' as verification;
