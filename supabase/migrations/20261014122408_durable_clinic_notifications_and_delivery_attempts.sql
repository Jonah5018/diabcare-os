-- Durable, provider-independent event and attempt records. No patient contacts.
alter table public.follow_ups add constraint follow_ups_notification_identity_key
  unique (id, patient_id, organization_id);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  patient_id uuid,
  appointment_id uuid,
  follow_up_id uuid,
  source_id uuid not null,
  source_revision text not null check (length(source_revision) between 1 and 80),
  kind text not null check (kind in ('appointment_reminder', 'appointment_cancelled', 'follow_up_reminder', 'clinic_notice')),
  provider text not null default 'in_app' check (provider = 'in_app'),
  status text not null default 'queued' check (status in ('queued', 'leased', 'submitted', 'delivered', 'failed', 'suppressed')),
  available_at timestamptz not null,
  lease_token uuid,
  lease_until timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (id, organization_id),
  unique (organization_id, kind, source_id, source_revision),
  constraint notification_patient_clinic_fkey foreign key (patient_id, organization_id)
    references public.patients (id, organization_id),
  constraint notification_appointment_identity_fkey foreign key (appointment_id, patient_id, organization_id)
    references public.appointments (id, patient_id, organization_id),
  constraint notification_follow_up_identity_fkey foreign key (follow_up_id, patient_id, organization_id)
    references public.follow_ups (id, patient_id, organization_id),
  check ((kind in ('appointment_reminder', 'appointment_cancelled') and appointment_id is not null and appointment_id = source_id and patient_id is not null and follow_up_id is null)
    or (kind = 'follow_up_reminder' and follow_up_id is not null and follow_up_id = source_id and patient_id is not null and appointment_id is null)
    or (kind = 'clinic_notice' and patient_id is null and appointment_id is null and follow_up_id is null)),
  check ((status = 'leased' and lease_token is not null and lease_until is not null)
    or (status <> 'leased' and lease_token is null and lease_until is null)),
  check ((status = 'delivered') = (delivered_at is not null))
);
create index notification_clinic_history_idx on public.notification_events (organization_id, created_at desc, id desc);
create index notification_due_jobs_idx on public.notification_events (available_at, id) where status in ('queued', 'leased');
create index notification_patient_fk_idx on public.notification_events (patient_id, organization_id);
create index notification_appointment_fk_idx on public.notification_events (appointment_id, patient_id, organization_id);
create index notification_follow_up_fk_idx on public.notification_events (follow_up_id, patient_id, organization_id);

create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null,
  attempt_number integer not null check (attempt_number between 1 and 5),
  lease_token uuid not null unique,
  provider text not null check (provider = 'in_app'),
  status text not null check (status in ('processing', 'submitted', 'delivered', 'failed', 'unknown')),
  result_code text check (result_code in ('inbox_persisted', 'provider_error', 'lease_expired', 'source_obsolete', 'clinic_unavailable')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (event_id, attempt_number),
  constraint attempt_event_clinic_fkey foreign key (event_id, organization_id)
    references public.notification_events (id, organization_id)
);
create index notification_attempt_clinic_page_idx on public.notification_attempts (organization_id, created_at desc, id desc);
create index notification_attempt_event_fk_idx on public.notification_attempts (event_id, organization_id);

create table public.notification_inbox (
  event_id uuid primary key,
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  constraint inbox_event_clinic_fkey foreign key (event_id, organization_id)
    references public.notification_events (id, organization_id)
);
create index notification_inbox_clinic_idx on public.notification_inbox (organization_id, created_at desc, event_id desc);
create index notification_inbox_event_fk_idx on public.notification_inbox (event_id, organization_id);

alter table public.notification_events enable row level security;
alter table public.notification_attempts enable row level security;
alter table public.notification_inbox enable row level security;
revoke all on public.notification_events, public.notification_attempts, public.notification_inbox from public, anon, authenticated;
grant select on public.notification_events, public.notification_attempts, public.notification_inbox to authenticated;
grant select, insert, update on public.notification_events, public.notification_attempts, public.notification_inbox to service_role;
create policy "Clinic staff read notification events" on public.notification_events for select to authenticated
  using (organization_id = (select private.current_organization_id()));
create policy "Clinic managers read delivery attempts" on public.notification_attempts for select to authenticated
  using (organization_id = (select private.current_organization_id()) and exists (
    select 1 from public.users where id = (select auth.uid()) and role in ('platform_owner', 'organization_admin')));
create policy "Clinic staff read durable inbox" on public.notification_inbox for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create function private.enqueue_clinical_notification()
returns trigger language plpgsql security definer set search_path = '' as $event$
declare
  v_kind text;
  v_revision text;
  v_due timestamptz;
begin
  if tg_table_name = 'appointments' then
    if tg_op = 'INSERT' and new.status = 'scheduled' then
      v_kind := 'appointment_reminder';
      v_revision := new.appointment_date::text;
      v_due := (new.appointment_date::timestamp - interval '1 day' + interval '9 hours') at time zone 'Africa/Lagos';
    elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status <> 'cancelled' then
      v_kind := 'appointment_cancelled';
      v_revision := 'cancelled';
      v_due := now();
    else return new;
    end if;
    insert into public.notification_events (organization_id, patient_id, appointment_id,
      source_id, source_revision, kind, available_at)
    values (new.organization_id, new.patient_id, new.id, new.id, v_revision, v_kind, greatest(v_due, now()))
    on conflict (organization_id, kind, source_id, source_revision) do nothing;
  else
    if new.status <> 'planned' or (tg_op = 'UPDATE' and old.due_date = new.due_date and old.status = new.status) then return new; end if;
    insert into public.notification_events (organization_id, patient_id, follow_up_id,
      source_id, source_revision, kind, available_at)
    values (new.organization_id, new.patient_id, new.id, new.id, new.due_date::text,
      'follow_up_reminder', greatest(now(), (new.due_date::timestamp + interval '9 hours') at time zone 'Africa/Lagos'))
    on conflict (organization_id, kind, source_id, source_revision) do nothing;
  end if;
  return new;
end;
$event$;
revoke all on function private.enqueue_clinical_notification() from public, anon, authenticated;
create trigger appointment_notification_event after insert or update on public.appointments
  for each row execute function private.enqueue_clinical_notification();
create trigger follow_up_notification_event after insert or update on public.follow_ups
  for each row execute function private.enqueue_clinical_notification();

create function private.notification_worker_clinic()
returns uuid language plpgsql security definer set search_path = '' as $guard$
declare v_clinic uuid;
begin
  -- PostgREST sets the database role after validating the credential.
  -- Never use editable metadata or an alleged role in submitted JSON.
  if current_setting('role', true) = 'service_role' then return null; end if;
  v_clinic := private.administration_clinic();
  if v_clinic is distinct from private.current_organization_id() then
    raise exception using errcode = '42501', message = 'Active clinic required';
  end if;
  return v_clinic;
end;
$guard$;
revoke all on function private.notification_worker_clinic() from public, anon, authenticated;

create function private.claim_notification_jobs(p_limit integer default 10)
returns setof public.notification_events language plpgsql security definer set search_path = '' as $claim$
declare
  v_clinic uuid := private.notification_worker_clinic();
  v_event public.notification_events%rowtype;
  v_token uuid;
begin
  if p_limit is null or p_limit not between 1 and 10 then
    raise exception using errcode = '22023', message = 'Claim 1 to 10 jobs';
  end if;
  for v_event in select * from public.notification_events
    where (v_clinic is null or organization_id = v_clinic) and available_at <= now()
      and (status = 'queued' or (status = 'leased' and lease_until < now()))
    order by available_at, id limit p_limit for update skip locked
  loop
    if v_event.status = 'leased' then
      update public.notification_attempts set status = 'unknown', result_code = 'lease_expired', finished_at = now()
        where lease_token = v_event.lease_token and status = 'processing';
    end if;
    if v_event.attempt_count >= 5 then
      update public.notification_events set status = 'failed', lease_token = null, lease_until = null,
        updated_at = now() where id = v_event.id;
      continue;
    end if;
    v_token := gen_random_uuid();
    update public.notification_events set status = 'leased', attempt_count = attempt_count + 1,
      lease_token = v_token, lease_until = now() + interval '3 minutes', updated_at = now()
      where id = v_event.id returning * into v_event;
    insert into public.notification_attempts (organization_id, event_id, attempt_number, lease_token, provider, status)
      values (v_event.organization_id, v_event.id, v_event.attempt_count, v_token, v_event.provider, 'processing');
    return next v_event;
  end loop;
end;
$claim$;
create function public.claim_notification_jobs(p_limit integer default 10)
returns setof public.notification_events language sql security invoker set search_path = '' as $wrapper$
  select * from private.claim_notification_jobs(p_limit);
$wrapper$;

create function private.deliver_in_app_notification(p_event uuid, p_token uuid)
returns text language plpgsql security definer set search_path = '' as $delivery$
declare
  v_clinic uuid := private.notification_worker_clinic();
  v_event public.notification_events%rowtype;
  v_obsolete boolean := false;
begin
  select * into v_event from public.notification_events where id = p_event
    and (v_clinic is null or organization_id = v_clinic) for update;
  if not found or v_event.status <> 'leased' or v_event.lease_token is distinct from p_token or v_event.lease_until < now() then
    raise exception using errcode = '42501', message = 'Valid current job lease required';
  end if;
  if v_event.kind = 'appointment_reminder' then
    v_obsolete := not exists (select 1 from public.appointments where id = v_event.appointment_id
      and status = 'scheduled' and appointment_date::text = v_event.source_revision
      and appointment_date >= (now() at time zone 'Africa/Lagos')::date);
  elsif v_event.kind = 'follow_up_reminder' then
    v_obsolete := not exists (select 1 from public.follow_ups where id = v_event.follow_up_id
      and status = 'planned' and due_date::text = v_event.source_revision);
  end if;
  if v_obsolete then
    update public.notification_events set status = 'suppressed', lease_token = null, lease_until = null, updated_at = now() where id = v_event.id;
    update public.notification_attempts set status = 'failed', result_code = 'source_obsolete', finished_at = now() where lease_token = p_token;
    return 'suppressed';
  end if;
  insert into public.notification_inbox (event_id, organization_id) values (v_event.id, v_event.organization_id)
    on conflict (event_id) do nothing;
  -- Durable inbox insertion and completion are atomic for the in-app provider.
  update public.notification_events set status = 'delivered', delivered_at = now(),
    lease_token = null, lease_until = null, updated_at = now() where id = v_event.id;
  update public.notification_attempts set status = 'delivered', result_code = 'inbox_persisted', finished_at = now() where lease_token = p_token;
  return 'delivered';
end;
$delivery$;
create function public.deliver_in_app_notification(p_event uuid, p_token uuid)
returns text language sql security invoker set search_path = '' as $wrapper$
  select private.deliver_in_app_notification(p_event, p_token);
$wrapper$;

create function private.fail_notification_attempt(p_event uuid, p_token uuid)
returns void language plpgsql security definer set search_path = '' as $failure$
declare
  v_clinic uuid := private.notification_worker_clinic();
  v_event public.notification_events%rowtype;
begin
  select * into v_event from public.notification_events where id = p_event
    and (v_clinic is null or organization_id = v_clinic) for update;
  if not found or v_event.status <> 'leased' or v_event.lease_token is distinct from p_token or v_event.lease_until < now() then
    raise exception using errcode = '42501', message = 'Valid current job lease required';
  end if;
  update public.notification_attempts set status = 'failed', result_code = 'provider_error', finished_at = now() where lease_token = p_token;
  update public.notification_events set status = case when attempt_count >= 5 then 'failed' else 'queued' end,
    available_at = now() + make_interval(secs => least(3600, 30 * (2 ^ attempt_count)::integer)),
    lease_token = null, lease_until = null, updated_at = now() where id = v_event.id;
end;
$failure$;
create function public.fail_notification_attempt(p_event uuid, p_token uuid)
returns void language sql security invoker set search_path = '' as $wrapper$
  select private.fail_notification_attempt(p_event, p_token);
$wrapper$;

create function private.queue_clinic_notice(p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $notice$
declare v_clinic uuid := private.notification_worker_clinic(); v_id uuid;
begin
  if v_clinic is null or p_request is null then
    raise exception using errcode = '22023', message = 'Clinic staff context and request required';
  end if;
  insert into public.notification_events (organization_id, source_id, source_revision, kind, available_at)
    values (v_clinic, p_request, '1', 'clinic_notice', now())
    on conflict (organization_id, kind, source_id, source_revision) do update set source_id = excluded.source_id
    returning id into v_id;
  return v_id;
end;
$notice$;
create function public.queue_clinic_notice(p_request uuid)
returns uuid language sql security invoker set search_path = '' as $wrapper$
  select private.queue_clinic_notice(p_request);
$wrapper$;

revoke all on function private.claim_notification_jobs(integer), public.claim_notification_jobs(integer),
  private.deliver_in_app_notification(uuid, uuid), public.deliver_in_app_notification(uuid, uuid),
  private.fail_notification_attempt(uuid, uuid), public.fail_notification_attempt(uuid, uuid),
  private.queue_clinic_notice(uuid), public.queue_clinic_notice(uuid) from public, anon;
grant execute on function private.claim_notification_jobs(integer), public.claim_notification_jobs(integer),
  private.deliver_in_app_notification(uuid, uuid), public.deliver_in_app_notification(uuid, uuid),
  private.fail_notification_attempt(uuid, uuid), public.fail_notification_attempt(uuid, uuid) to authenticated, service_role;
grant execute on function private.queue_clinic_notice(uuid), public.queue_clinic_notice(uuid) to authenticated;
