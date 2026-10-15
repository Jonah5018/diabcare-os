-- Deliberate global metadata administration. Clinical pages remain tenant-scoped.
alter table public.organizations add column operational_status text not null default 'active'
  check (operational_status in ('active', 'suspended'));
create index organizations_platform_page_idx on public.organizations (created_at desc nulls last, id desc);
create index organizations_operational_status_idx on public.organizations (operational_status);

create function private.clinic_is_active(p_clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $active$
  select exists (select 1 from public.organizations where id = p_clinic and operational_status = 'active');
$active$;
revoke all on function private.clinic_is_active(uuid) from public, anon;
grant execute on function private.clinic_is_active(uuid) to authenticated;

create or replace function private.current_organization_id()
returns uuid language sql stable security definer set search_path = '' as $clinic$
  select u.organization_id from public.users u join public.organizations o on o.id = u.organization_id
  where u.id = (select auth.uid()) and u.is_active and o.operational_status = 'active' limit 1;
$clinic$;

create function public.get_clinic_workspace_status()
returns text language sql stable security invoker set search_path = '' as $workspace$
  select o.operational_status from public.organizations o join public.users u on u.organization_id = o.id
    where u.id = auth.uid() and u.is_active;
$workspace$;
revoke all on function public.get_clinic_workspace_status() from public, anon;
grant execute on function public.get_clinic_workspace_status() to authenticated;

-- Restrictive policies add an active-clinic requirement without widening any
-- existing role/ownership policy. Triggers also protect guarded definer writes.
create function private.enforce_active_clinic_write()
returns trigger language plpgsql security definer set search_path = '' as $guard$
declare v_status text;
begin
  select operational_status into v_status from public.organizations
    where id = new.organization_id for share;
  if v_status is distinct from 'active' then
    raise exception using errcode = '42501', message = 'Clinic is unavailable for writes';
  end if;
  return new;
end;
$guard$;
revoke all on function private.enforce_active_clinic_write() from public, anon, authenticated;
do $policies$
declare v_table text;
begin
  foreach v_table in array array['patients', 'appointments', 'consultations', 'vitals',
    'laboratory_results', 'prescriptions', 'prescription_items', 'follow_ups', 'clinical_documents'] loop
    execute format('create policy "Active clinic restriction" on public.%I as restrictive for all to authenticated
      using (private.clinic_is_active(organization_id)) with check (private.clinic_is_active(organization_id))', v_table);
    execute format('create trigger active_clinic_write before insert or update on public.%I
      for each row execute function private.enforce_active_clinic_write()', v_table);
  end loop;
end;
$policies$;
create trigger invitation_active_clinic before insert or update on public.staff_invitations
  for each row execute function private.enforce_active_clinic_write();
create trigger staff_active_clinic before insert on public.users
  for each row execute function private.enforce_active_clinic_write();
create policy "Clinical files require active clinic" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'clinical-documents' or (select private.current_organization_id()) is not null)
  with check (bucket_id <> 'clinical-documents' or (select private.current_organization_id()) is not null);

create function private.is_platform_owner()
returns boolean language sql stable security definer set search_path = '' as $owner$
  select exists (select 1 from public.users where id = auth.uid() and is_active and role = 'platform_owner');
$owner$;
revoke all on function private.is_platform_owner() from public, anon;
grant execute on function private.is_platform_owner() to authenticated;

create table public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id),
  organization_id uuid not null references public.organizations (id),
  action text not null check (action in ('clinic_status_changed', 'billing_binding_created', 'subscription_updated')),
  reason_code text check (reason_code in ('operational_review', 'security_review', 'clinic_request', 'resolved')),
  previous_status text,
  status text,
  created_at timestamptz not null default now()
);
create index platform_audit_actor_fk_idx on public.platform_audit_events (actor_id);
create index platform_audit_clinic_page_idx on public.platform_audit_events (organization_id, created_at desc, id desc);
alter table public.platform_audit_events enable row level security;
revoke all on public.platform_audit_events from public, anon, authenticated;
grant select on public.platform_audit_events to authenticated;
create policy "Only active owners read platform audit" on public.platform_audit_events for select to authenticated
  using ((select private.is_platform_owner()));

create function private.set_clinic_operational_status(p_clinic uuid, p_status text, p_expected text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $status$
declare v_actor uuid := private.require_platform_owner(); v_previous text;
begin
  if p_status is null or p_status not in ('active', 'suspended') or p_expected is null
    or p_expected not in ('active', 'suspended') or p_reason is null
    or p_reason not in ('operational_review', 'security_review', 'clinic_request', 'resolved') then
    raise exception using errcode = '22023', message = 'Valid status and reason code required';
  end if;
  select operational_status into v_previous from public.organizations where id = p_clinic for update;
  if not found then raise exception using errcode = '22023', message = 'Clinic not found'; end if;
  if v_previous = p_status then return; end if;
  if v_previous <> p_expected then raise exception using errcode = '40001', message = 'Clinic status changed; refresh'; end if;
  update public.organizations set operational_status = p_status, updated_at = now() where id = p_clinic;
  insert into public.platform_audit_events (actor_id, organization_id, action, reason_code, previous_status, status)
    values (v_actor, p_clinic, 'clinic_status_changed', p_reason, v_previous, p_status);
end;
$status$;
create function public.set_clinic_operational_status(p_clinic uuid, p_status text, p_expected text, p_reason text)
returns void language sql security invoker set search_path = '' as $wrapper$
  select private.set_clinic_operational_status(p_clinic, p_status, p_expected, p_reason);
$wrapper$;

create function private.platform_organizations(p_cursor_time timestamptz default null, p_cursor_id uuid default null)
returns table (id uuid, name text, operational_status text, created_at timestamptz, subscription_status text, plan_id text)
language plpgsql security definer set search_path = '' as $directory$
begin
  perform private.require_platform_owner();
  if p_cursor_time is not null and p_cursor_id is null then raise exception using errcode = '22023', message = 'Complete cursor required'; end if;
  return query select o.id, o.name, o.operational_status, o.created_at, s.status, s.plan_id
    from public.organizations o left join public.organization_subscriptions s on s.organization_id = o.id
    where p_cursor_id is null
      or (p_cursor_time is not null and ((o.created_at, o.id) < (p_cursor_time, p_cursor_id) or o.created_at is null))
      or (p_cursor_time is null and o.created_at is null and o.id < p_cursor_id)
    order by o.created_at desc nulls last, o.id desc limit 26;
end;
$directory$;
create function public.platform_organizations(p_cursor_time timestamptz default null, p_cursor_id uuid default null)
returns table (id uuid, name text, operational_status text, created_at timestamptz, subscription_status text, plan_id text)
language sql security invoker set search_path = '' as $wrapper$
  select * from private.platform_organizations(p_cursor_time, p_cursor_id);
$wrapper$;

create function private.platform_overview()
returns jsonb language plpgsql security definer set search_path = '' as $overview$
begin
  perform private.require_platform_owner();
  return jsonb_build_object('clinics', (select count(*) from public.organizations),
    'active_clinics', (select count(*) from public.organizations where operational_status = 'active'),
    'suspended_clinics', (select count(*) from public.organizations where operational_status = 'suspended'),
    'managed_subscriptions', (select count(*) from public.organization_subscriptions),
    'past_due_subscriptions', (select count(*) from public.organization_subscriptions where status = 'past_due'));
end;
$overview$;
create function public.platform_overview()
returns jsonb language sql security invoker set search_path = '' as $wrapper$
  select private.platform_overview();
$wrapper$;

create function private.platform_clinic_details(p_clinic uuid)
returns jsonb language plpgsql security definer set search_path = '' as $details$
declare v_result jsonb;
begin
  perform private.require_platform_owner();
  select jsonb_build_object('id', o.id, 'name', o.name, 'operational_status', o.operational_status,
    'subscription_status', s.status, 'plan_id', s.plan_id,
    'staff_count', (select count(*) from public.users where organization_id = o.id),
    'patient_count', (select count(*) from public.patients where organization_id = o.id),
    'binding_configured', exists (select 1 from private.billing_account_links where organization_id = o.id))
    into v_result from public.organizations o left join public.organization_subscriptions s on s.organization_id = o.id
    where o.id = p_clinic;
  if v_result is null then raise exception using errcode = '22023', message = 'Clinic not found'; end if;
  return v_result;
end;
$details$;
create function public.platform_clinic_details(p_clinic uuid)
returns jsonb language sql security invoker set search_path = '' as $wrapper$
  select private.platform_clinic_details(p_clinic);
$wrapper$;

create function private.record_platform_billing_audit()
returns trigger language plpgsql security definer set search_path = '' as $audit$
begin
  insert into public.platform_audit_events (actor_id, organization_id, action, status)
    values (auth.uid(), new.organization_id,
      case when tg_table_name = 'billing_account_links' then 'billing_binding_created' else 'subscription_updated' end,
      to_jsonb(new)->>'status');
  return new;
end;
$audit$;
revoke all on function private.record_platform_billing_audit() from public, anon, authenticated;
create trigger billing_binding_platform_audit after insert on private.billing_account_links
  for each row execute function private.record_platform_billing_audit();
create trigger subscription_platform_audit after insert or update on public.organization_subscriptions
  for each row execute function private.record_platform_billing_audit();

revoke all on function private.set_clinic_operational_status(uuid, text, text, text), public.set_clinic_operational_status(uuid, text, text, text),
  private.platform_organizations(timestamptz, uuid), public.platform_organizations(timestamptz, uuid),
  private.platform_overview(), public.platform_overview(), private.platform_clinic_details(uuid), public.platform_clinic_details(uuid) from public, anon;
grant execute on function private.set_clinic_operational_status(uuid, text, text, text), public.set_clinic_operational_status(uuid, text, text, text),
  private.platform_organizations(timestamptz, uuid), public.platform_organizations(timestamptz, uuid),
  private.platform_overview(), public.platform_overview(), private.platform_clinic_details(uuid), public.platform_clinic_details(uuid) to authenticated;

create or replace function private.clinic_feature_enabled(p_clinic uuid, p_feature text)
returns boolean language plpgsql stable security definer set search_path = '' as $feature$
declare v_subscription record;
begin
  if not private.clinic_is_active(p_clinic) or p_clinic is null or p_feature not in ('storage', 'communications', 'advanced_reports') then return false; end if;
  select s.*, p.features into v_subscription from public.organization_subscriptions s
    join public.billing_plans p on p.id = s.plan_id where s.organization_id = p_clinic;
  -- Existing unconfigured clinics keep their existing capabilities.
  if not found then return true; end if;
  return coalesce((v_subscription.features->>p_feature)::boolean, false)
    and (v_subscription.status = 'active' or (v_subscription.status = 'trial'
      and v_subscription.trial_ends_at is not null and v_subscription.trial_ends_at > now()));
end;
$feature$;
