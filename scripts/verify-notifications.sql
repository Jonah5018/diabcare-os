begin;
do $verify$
declare
  clinic uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  foreign_actor uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  appointment uuid;
  notice uuid;
  job public.notification_events%rowtype;
  old_token uuid;
  blocked boolean;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary notification clinic', 'verify-notification-' || clinic),
    (other, 'Temporary foreign clinic', 'verify-notification-' || other);
  insert into auth.users (id, email, aud, role) values
    (actor, actor || '@example.invalid', 'authenticated', 'authenticated'),
    (foreign_actor, foreign_actor || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (actor, clinic, 'Synthetic admin', actor || '@example.invalid', 'organization_admin', true),
    (foreign_actor, other, 'Synthetic foreign admin', foreign_actor || '@example.invalid', 'organization_admin', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name)
    values (patient, clinic, 'VERIFY-NOTIFY-' || patient, 'Synthetic', 'Patient');
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  insert into public.appointments (organization_id, patient_id, appointment_date, created_by, status)
    values (clinic, patient, current_date + 7, actor, 'scheduled') returning id into appointment;
  if not exists (select 1 from public.notification_events where appointment_id = appointment and status = 'queued') then
    raise exception 'Clinical event was not durably enqueued';
  end if;
  notice := public.queue_clinic_notice(gen_random_uuid());
  select * into job from public.claim_notification_jobs(1);
  if job.id <> notice or job.attempt_count <> 1 or job.lease_token is null then raise exception 'Claim/availability failed'; end if;
  if exists (select 1 from public.claim_notification_jobs(10)) then raise exception 'Live lease or future event claimed twice'; end if;
  blocked := false;
  begin perform public.deliver_in_app_notification(job.id, gen_random_uuid());
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Forged lease delivered'; end if;
  if public.deliver_in_app_notification(job.id, job.lease_token) <> 'delivered' then
    raise exception 'Delivery command did not confirm persistence';
  end if;
  if not exists (select 1 from public.notification_inbox where event_id = notice) then
    raise exception 'Durable inbox delivery failed';
  end if;
  notice := public.queue_clinic_notice(gen_random_uuid());
  select * into job from public.claim_notification_jobs(1);
  old_token := job.lease_token;
  execute 'reset role';
  update public.notification_events set lease_until = now() - interval '1 second' where id = job.id;
  execute 'set local role authenticated';
  select * into job from public.claim_notification_jobs(1);
  if job.attempt_count <> 2 or job.lease_token = old_token then raise exception 'Expired lease did not recover'; end if;
  blocked := false;
  begin perform public.deliver_in_app_notification(job.id, old_token);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Expired token delivered'; end if;
  perform public.deliver_in_app_notification(job.id, job.lease_token);
  notice := public.queue_clinic_notice(gen_random_uuid());
  select * into job from public.claim_notification_jobs(1);
  execute 'reset role';
  update public.organizations set operational_status = 'suspended' where id = clinic;
  execute 'set local role service_role';
  if public.deliver_in_app_notification(job.id, job.lease_token) <> 'suppressed' then
    raise exception 'Backend delivered after clinic suspension';
  end if;
  execute 'reset role';
  update public.organizations set operational_status = 'active' where id = clinic;
  execute 'set local role authenticated';
  select event_id into notice from public.notification_inbox where organization_id = clinic limit 1;
  perform set_config('request.jwt.claim.sub', foreign_actor::text, true);
  if exists (select 1 from public.notification_events where organization_id = clinic)
    or exists (select 1 from public.notification_inbox where organization_id = clinic) then
    raise exception 'Foreign notification data exposed';
  end if;
  blocked := false;
  begin perform public.deliver_in_app_notification(job.id, job.lease_token);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Foreign notification processed'; end if;
  execute 'reset role';
  update public.users set role = 'doctor' where id = actor;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  if not exists (select 1 from public.notification_inbox where event_id = notice) then raise exception 'Staff inbox read failed'; end if;
  blocked := false;
  begin perform public.claim_notification_jobs(10);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Doctor claimed administrative jobs'; end if;
  blocked := false;
  begin update public.notification_events set status = 'delivered';
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Direct notification mutation allowed'; end if;
  execute 'reset role';
end;
$verify$;
rollback;
select 'PASS: transactional enqueue, due-job limits, exclusive/expired leases, stale-token denial, suspension recheck, tenant/role restrictions, durable inbox and revoked direct writes. Fixtures rolled back.' as verification;
