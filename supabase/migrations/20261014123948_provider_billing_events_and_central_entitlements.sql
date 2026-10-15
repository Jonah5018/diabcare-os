-- Subscription state is established by trusted provider events, not the browser.
create function private.require_platform_owner()
returns uuid language plpgsql security definer set search_path = '' as $owner$
begin
  perform 1 from public.users where id = auth.uid() and is_active
    and role = 'platform_owner' for share;
  if not found then raise exception using errcode = '42501', message = 'Platform owner required'; end if;
  return auth.uid();
end;
$owner$;
revoke all on function private.require_platform_owner() from public, anon, authenticated;

create table public.billing_plans (
  id text primary key check (id in ('core', 'plus')),
  name text not null,
  features jsonb not null,
  staff_limit integer check (staff_limit > 0),
  patient_limit integer check (patient_limit > 0)
);
insert into public.billing_plans (id, name, features) values
  ('core', 'Core', '{"storage":true,"communications":false,"advanced_reports":false}'),
  ('plus', 'Plus', '{"storage":true,"communications":true,"advanced_reports":true}');

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations (id),
  plan_id text not null references public.billing_plans (id),
  status text not null check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider_event_time bigint not null,
  updated_at timestamptz not null default now()
);
create index subscription_plan_fk_idx on public.organization_subscriptions (plan_id);

create table private.billing_account_links (
  organization_id uuid primary key references public.organizations (id),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  customer_id text not null check (length(customer_id) between 1 and 200),
  subscription_id text not null check (length(subscription_id) between 1 and 200),
  updated_by uuid not null references public.users (id),
  updated_at timestamptz not null default now(),
  unique (provider, subscription_id),
  unique (provider, customer_id)
);
create index billing_link_editor_fk_idx on private.billing_account_links (updated_by);

create table private.billing_webhook_events (
  provider text not null,
  event_id text not null check (length(event_id) between 1 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  organization_id uuid references public.organizations (id),
  result text not null check (result in ('received', 'applied', 'ignored_stale', 'unmatched', 'needs_reconciliation')),
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
create index billing_webhook_clinic_fk_idx on private.billing_webhook_events (organization_id);
create index billing_webhook_attention_idx on private.billing_webhook_events (received_at)
  where result in ('unmatched', 'needs_reconciliation');

alter table public.billing_plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table private.billing_account_links enable row level security;
alter table private.billing_webhook_events enable row level security;
revoke all on public.billing_plans, public.organization_subscriptions from public, anon, authenticated;
revoke all on private.billing_account_links, private.billing_webhook_events from public, anon, authenticated;
grant select on public.billing_plans, public.organization_subscriptions to authenticated;
create policy "Active staff read plan definitions" on public.billing_plans for select to authenticated
  using ((select private.current_organization_id()) is not null);
create policy "Clinic managers read subscription" on public.organization_subscriptions for select to authenticated
  using (organization_id = (select private.current_organization_id()) and exists (
    select 1 from public.users where id = (select auth.uid()) and role in ('platform_owner', 'organization_admin')));

create function private.clinic_feature_enabled(p_clinic uuid, p_feature text)
returns boolean language plpgsql stable security definer set search_path = '' as $feature$
declare v_subscription record;
begin
  if p_clinic is null or p_feature not in ('storage', 'communications', 'advanced_reports') then return false; end if;
  select s.*, p.features into v_subscription from public.organization_subscriptions s
    join public.billing_plans p on p.id = s.plan_id where s.organization_id = p_clinic;
  -- Existing unconfigured clinics keep their existing capabilities.
  if not found then return true; end if;
  return coalesce((v_subscription.features->>p_feature)::boolean, false)
    and (v_subscription.status = 'active' or (v_subscription.status = 'trial'
      and v_subscription.trial_ends_at is not null and v_subscription.trial_ends_at > now()));
end;
$feature$;
revoke all on function private.clinic_feature_enabled(uuid, text) from public, anon, authenticated;

create function private.current_clinic_feature(p_feature text)
returns boolean language sql stable security definer set search_path = '' as $feature$
  select private.clinic_feature_enabled(private.current_organization_id(), p_feature);
$feature$;
create function public.current_clinic_feature(p_feature text)
returns boolean language sql stable security invoker set search_path = '' as $wrapper$
  select private.current_clinic_feature(p_feature);
$wrapper$;
revoke all on function private.current_clinic_feature(text), public.current_clinic_feature(text) from public, anon;
grant execute on function private.current_clinic_feature(text), public.current_clinic_feature(text) to authenticated;

create function private.get_clinic_entitlements()
returns jsonb language plpgsql stable security definer set search_path = '' as $entitlements$
declare v_clinic uuid := private.current_organization_id(); v_subscription jsonb;
begin
  if v_clinic is null then raise exception using errcode = '42501', message = 'Active clinic required'; end if;
  select jsonb_build_object('plan', p.name, 'plan_id', s.plan_id, 'status', s.status,
    'trial_ends_at', s.trial_ends_at, 'current_period_end', s.current_period_end,
    'staff_limit', p.staff_limit, 'patient_limit', p.patient_limit)
    into v_subscription from public.organization_subscriptions s join public.billing_plans p on p.id = s.plan_id
    where s.organization_id = v_clinic;
  return jsonb_build_object('subscription', v_subscription, 'legacy_access', v_subscription is null,
    'features', jsonb_build_object('storage', private.clinic_feature_enabled(v_clinic, 'storage'),
      'communications', private.clinic_feature_enabled(v_clinic, 'communications'),
      'advanced_reports', private.clinic_feature_enabled(v_clinic, 'advanced_reports')));
end;
$entitlements$;
create function public.get_clinic_entitlements()
returns jsonb language sql stable security invoker set search_path = '' as $wrapper$
  select private.get_clinic_entitlements();
$wrapper$;
revoke all on function private.get_clinic_entitlements(), public.get_clinic_entitlements() from public, anon;
grant execute on function private.get_clinic_entitlements(), public.get_clinic_entitlements() to authenticated;

create function private.bind_billing_account(p_provider text, p_clinic uuid, p_customer text, p_subscription text)
returns void language plpgsql security definer set search_path = '' as $binding$
declare v_actor uuid := private.require_platform_owner();
begin
  if not exists (select 1 from public.organizations where id = p_clinic)
    or p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,31}$'
    or p_customer is null or length(p_customer) not between 1 and 200
    or p_subscription is null or length(p_subscription) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Valid clinic and provider account identifiers required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('billing:' || p_clinic::text, 0));
  if exists (select 1 from private.billing_account_links where organization_id = p_clinic
    and (provider <> p_provider or customer_id <> p_customer or subscription_id <> p_subscription)) then
    raise exception using errcode = '22023', message = 'Existing provider binding cannot be reassigned through this command';
  end if;
  insert into private.billing_account_links (organization_id, provider, customer_id, subscription_id, updated_by)
    values (p_clinic, p_provider, p_customer, p_subscription, v_actor)
    on conflict (organization_id) do nothing;
end;
$binding$;
create function public.bind_billing_account(p_provider text, p_clinic uuid, p_customer text, p_subscription text)
returns void language sql security invoker set search_path = '' as $wrapper$
  select private.bind_billing_account(p_provider, p_clinic, p_customer, p_subscription);
$wrapper$;
revoke all on function private.bind_billing_account(text, uuid, text, text), public.bind_billing_account(text, uuid, text, text) from public, anon;
grant execute on function private.bind_billing_account(text, uuid, text, text), public.bind_billing_account(text, uuid, text, text) to authenticated;

create function public.ingest_billing_webhook(
  p_provider text, p_event text, p_hash text, p_customer text, p_subscription text,
  p_plan text, p_status text, p_time bigint, p_trial_end timestamptz, p_period_end timestamptz
)
returns text language plpgsql security invoker set search_path = '' as $webhook$
declare
  v_clinic uuid;
  v_existing private.billing_webhook_events%rowtype;
  v_previous public.organization_subscriptions%rowtype;
  v_result text := 'applied';
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception using errcode = '42501', message = 'Trusted billing processor required';
  end if;
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,31}$'
    or p_event is null or length(p_event) not between 1 and 200 or p_hash is null
    or p_hash !~ '^[0-9a-f]{64}$' or p_plan is null or p_plan not in ('core', 'plus')
    or p_status is null or p_status not in ('trial', 'active', 'past_due', 'suspended', 'cancelled')
    or p_time is null or p_time not between 0 and 4102444800 then
    raise exception using errcode = '22023', message = 'Invalid normalized billing event';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('billing-event:' || p_provider || ':' || p_event, 0));
  select * into v_existing from private.billing_webhook_events where provider = p_provider and event_id = p_event;
  if found then
    if v_existing.payload_hash <> p_hash then raise exception using errcode = '22023', message = 'Event identifier payload mismatch'; end if;
    return v_existing.result;
  end if;
  select organization_id into v_clinic from private.billing_account_links
    where provider = p_provider and customer_id = p_customer and subscription_id = p_subscription;
  if v_clinic is null then v_result := 'unmatched';
  else
    perform pg_advisory_xact_lock(hashtextextended('billing:' || v_clinic::text, 0));
    select * into v_previous from public.organization_subscriptions where organization_id = v_clinic;
    if found and p_time < v_previous.provider_event_time then v_result := 'ignored_stale';
    elsif found and p_time = v_previous.provider_event_time then
      v_result := case when (v_previous.plan_id, v_previous.status, v_previous.trial_ends_at, v_previous.current_period_end)
        is not distinct from (p_plan, p_status, p_trial_end, p_period_end) then 'ignored_stale' else 'needs_reconciliation' end;
    else
      insert into public.organization_subscriptions (organization_id, plan_id, status,
        trial_ends_at, current_period_end, provider_event_time)
      values (v_clinic, p_plan, p_status, p_trial_end, p_period_end, p_time)
      on conflict (organization_id) do update set plan_id = excluded.plan_id, status = excluded.status,
        trial_ends_at = excluded.trial_ends_at, current_period_end = excluded.current_period_end,
        provider_event_time = excluded.provider_event_time, updated_at = now();
    end if;
  end if;
  insert into private.billing_webhook_events (provider, event_id, payload_hash, organization_id, result)
    values (p_provider, p_event, p_hash, v_clinic, v_result);
  return v_result;
end;
$webhook$;
revoke all on function public.ingest_billing_webhook(text, text, text, text, text, text, text, bigint, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ingest_billing_webhook(text, text, text, text, text, text, text, bigint, timestamptz, timestamptz) to service_role;
grant usage on schema private to service_role;
grant select, insert on private.billing_account_links, private.billing_webhook_events to service_role;
grant select, insert, update on public.organization_subscriptions to service_role;
grant select on public.billing_plans to service_role;

create function private.enforce_document_storage_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $guard$
begin
  if not private.clinic_feature_enabled(new.organization_id, 'storage') then
    raise exception using errcode = '42501', message = 'Document storage entitlement unavailable';
  end if;
  return new;
end;
$guard$;
revoke all on function private.enforce_document_storage_entitlement() from public, anon, authenticated;
create trigger document_storage_entitlement before insert on public.clinical_documents
  for each row execute function private.enforce_document_storage_entitlement();
create policy "Clinical uploads require storage entitlement" on storage.objects
  as restrictive for insert to authenticated with check (
    bucket_id <> 'clinical-documents' or (select public.current_clinic_feature('storage'))
  );

create or replace function private.claim_notification_jobs(p_limit integer default 10)
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
    where (v_clinic is null or organization_id = v_clinic) and private.clinic_feature_enabled(organization_id, 'communications') and available_at <= now()
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

create or replace function public.get_clinic_operational_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $report$
declare
  v_clinic uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_result jsonb;
begin
  select organization_id into v_clinic from public.users
  where id = auth.uid() and is_active = true
    and role in ('platform_owner', 'organization_admin', 'doctor');
  if v_clinic is null then raise exception using errcode = '42501', message = 'Reports permission required'; end if;
  if not public.current_clinic_feature('advanced_reports') then
    raise exception using errcode = '42501', message = 'Advanced report entitlement unavailable';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 30 then
    raise exception using errcode = '22023', message = 'Use a report window of up to 31 days';
  end if;
  v_start := p_from::timestamp at time zone 'Africa/Lagos';
  v_end := (p_to + 1)::timestamp at time zone 'Africa/Lagos';

  with bookings as (
    select patient_id, status from public.appointments
    where organization_id = v_clinic and appointment_date between p_from and p_to
  ), cohort as (
    select distinct patient_id from bookings where status <> 'cancelled'
  ), follow_ups as (
    select status, due_date from public.follow_ups
    where organization_id = v_clinic and due_date between p_from and p_to
  )
  select jsonb_build_object(
    'registrations', (select count(*) from public.patients where organization_id = v_clinic and created_at >= v_start and created_at < v_end),
    'bookings', (select count(*) from bookings),
    'non_cancelled', (select count(*) from bookings where status <> 'cancelled'),
    'completed', (select count(*) from bookings where status = 'completed'),
    'cancelled', (select count(*) from bookings where status = 'cancelled'),
    'check_ins', (select count(*) from public.appointments where organization_id = v_clinic and checked_in_at >= v_start and checked_in_at < v_end),
    'consultations', (select count(*) from public.consultations where organization_id = v_clinic and coalesce(visit_date, created_at) >= v_start and coalesce(visit_date, created_at) < v_end),
    'vitals', (select count(*) from public.vitals where organization_id = v_clinic and created_at >= v_start and created_at < v_end),
    'laboratory', (select count(*) from public.laboratory_results where organization_id = v_clinic and created_at >= v_start and created_at < v_end),
    'prescriptions', (select count(*) from public.prescriptions where organization_id = v_clinic and prescribed_date between p_from and p_to),
    'follow_ups_due', (select count(*) from follow_ups),
    'follow_ups_planned', (select count(*) from follow_ups where status = 'planned'),
    'follow_ups_overdue', (select count(*) from follow_ups where status = 'planned' and due_date < v_today),
    'cohort_patients', (select count(*) from cohort),
    'cohort_with_vitals', (select count(distinct v.patient_id) from public.vitals v join cohort c on c.patient_id = v.patient_id where v.organization_id = v_clinic and v.created_at >= v_start and v.created_at < v_end),
    'cohort_with_labs', (select count(distinct l.patient_id) from public.laboratory_results l join cohort c on c.patient_id = l.patient_id where l.organization_id = v_clinic and l.created_at >= v_start and l.created_at < v_end)
  ) into v_result;
  return v_result;
end;
$report$;
