-- Operational diagnostics expose fixed counts and schema readiness, not records.
create index notification_failed_jobs_idx on public.notification_events (updated_at) where status = 'failed';
create index notification_expired_lease_idx on public.notification_events (lease_until) where status = 'leased';
create index subscription_attention_idx on public.organization_subscriptions (current_period_end)
  where status in ('active', 'past_due');

create function private.platform_operations_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $snapshot$
begin
  perform private.require_platform_owner();
  return jsonb_build_object(
    'failed_notifications', (select count(*) from public.notification_events where status = 'failed'),
    'expired_leases', (select count(*) from public.notification_events
      where status = 'leased' and lease_until < now() and private.clinic_feature_enabled(organization_id, 'communications')),
    'due_notifications', (select count(*) from public.notification_events
      where status = 'queued' and available_at <= now() and private.clinic_feature_enabled(organization_id, 'communications')),
    'oldest_due_seconds', (select coalesce(greatest(0, floor(extract(epoch from now() - min(available_at))))::bigint, 0)
      from public.notification_events where status = 'queued' and available_at <= now()
        and private.clinic_feature_enabled(organization_id, 'communications')),
    'billing_reconciliation', (select count(*) from private.billing_webhook_events where result in ('unmatched', 'needs_reconciliation')),
    'expired_billing_periods', (select count(*) from public.organization_subscriptions
      where status = 'active' and (current_period_end is null or current_period_end <= now()))
  );
end;
$snapshot$;
create function public.platform_operations_snapshot()
returns jsonb language sql security invoker set search_path = '' as $wrapper$
  select private.platform_operations_snapshot();
$wrapper$;
revoke all on function private.platform_operations_snapshot(), public.platform_operations_snapshot() from public, anon;
grant execute on function private.platform_operations_snapshot(), public.platform_operations_snapshot() to authenticated;

create function public.operations_readiness_probe()
returns jsonb language sql security invoker set search_path = '' as $probe$
  select jsonb_build_object('database', 'ok', 'queue_schema', to_regclass('public.notification_events') is not null,
    'billing_schema', to_regclass('private.billing_webhook_events') is not null);
$probe$;
revoke all on function public.operations_readiness_probe() from public, anon, authenticated;
grant execute on function public.operations_readiness_probe() to service_role;

create or replace function private.clinic_feature_enabled(p_clinic uuid, p_feature text)
returns boolean language plpgsql stable security definer set search_path = '' as $feature$
declare v_subscription record;
begin
  if not private.clinic_is_active(p_clinic) or p_clinic is null or p_feature is null or p_feature not in ('storage', 'communications', 'advanced_reports') then return false; end if;
  select s.*, p.features into v_subscription from public.organization_subscriptions s
    join public.billing_plans p on p.id = s.plan_id where s.organization_id = p_clinic;
  -- Existing unconfigured clinics keep their existing capabilities.
  if not found then return true; end if;
  return coalesce((v_subscription.features->>p_feature)::boolean, false)
    and ((v_subscription.status = 'active' and v_subscription.current_period_end is not null and v_subscription.current_period_end > now()) or (v_subscription.status = 'trial'
      and v_subscription.trial_ends_at is not null and v_subscription.trial_ends_at > now()));
end;
$feature$;

create or replace function private.document_clinic(p_upload boolean)
returns uuid language plpgsql security definer set search_path = '' as $guard$
declare
  v_actor public.users%rowtype;
begin
  select * into v_actor from public.users where id = auth.uid() and is_active for share;
  if not found or v_actor.organization_id is null or v_actor.role not in
    ('platform_owner', 'organization_admin', 'doctor', 'nurse', 'lab_scientist', 'receptionist')
    or (p_upload and v_actor.role = 'receptionist') then
    raise exception using errcode = '42501', message = 'Document permission denied';
  end if;
  if not private.clinic_is_active(v_actor.organization_id) then
    raise exception using errcode = '42501', message = 'Active clinic required';
  end if;
  return v_actor.organization_id;
end;
$guard$;

create or replace function private.deliver_in_app_notification(p_event uuid, p_token uuid)
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
  if not private.clinic_feature_enabled(v_event.organization_id, 'communications') then
    update public.notification_events set status = 'suppressed', lease_token = null, lease_until = null, updated_at = now() where id = v_event.id;
    update public.notification_attempts set status = 'failed', result_code = 'clinic_unavailable', finished_at = now() where lease_token = p_token;
    return 'suppressed';
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

-- Do not expose internal lease credentials through ordinary table reads.
revoke select on public.notification_events, public.notification_attempts from authenticated;
grant select (id, organization_id, patient_id, appointment_id, follow_up_id, source_id, source_revision,
  kind, provider, status, available_at, attempt_count, created_at, updated_at, delivered_at)
  on public.notification_events to authenticated;
grant select (id, organization_id, event_id, attempt_number, provider, status, result_code, created_at, finished_at)
  on public.notification_attempts to authenticated;

do $restrictions$
declare v_table text;
begin
  foreach v_table in array array['audit_events', 'staff_invitations', 'audit_retention_settings',
    'notification_events', 'notification_attempts', 'notification_inbox', 'organization_subscriptions'] loop
    execute format('create policy "Active clinic metadata restriction" on public.%I as restrictive for all to authenticated
      using (private.clinic_is_active(organization_id)) with check (private.clinic_is_active(organization_id))', v_table);
  end loop;
end;
$restrictions$;

-- Provider identifiers are transport-neutral; only registered adapters execute.
alter table public.notification_events drop constraint notification_events_provider_check;
alter table public.notification_events add constraint notification_events_provider_check
  check (provider ~ '^[a-z][a-z0-9_]{1,31}$');
alter table public.notification_attempts drop constraint notification_attempts_provider_check;
alter table public.notification_attempts add constraint notification_attempts_provider_check
  check (provider ~ '^[a-z][a-z0-9_]{1,31}$');

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type in ('patients', 'appointments', 'consultations', 'vitals', 'laboratory_results',
    'prescriptions', 'prescription_items', 'follow_ups', 'staff_invitations', 'organizations',
    'users', 'audit_events', 'audit_retention_settings', 'clinical_documents', 'notification_events')
);
create or replace function private.queue_clinic_notice(p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $notice$
declare v_clinic uuid := private.notification_worker_clinic(); v_id uuid;
begin
  if v_clinic is null or p_request is null then
    raise exception using errcode = '22023', message = 'Clinic context and request required';
  end if;
  if not private.clinic_feature_enabled(v_clinic, 'communications') then
    raise exception using errcode = '42501', message = 'Communications entitlement unavailable';
  end if;
  insert into public.notification_events (organization_id, source_id, source_revision, kind, available_at)
    values (v_clinic, p_request, '1', 'clinic_notice', now())
    on conflict (organization_id, kind, source_id, source_revision) do nothing returning id into v_id;
  if v_id is not null then
    insert into public.audit_events (organization_id, actor_id, entity_type, record_id, operation, details)
      values (v_clinic, auth.uid(), 'notification_events', v_id, 'INSERT',
        jsonb_build_object('status', 'queued', 'kind', 'clinic_notice'));
  else
    select id into v_id from public.notification_events where organization_id = v_clinic
      and kind = 'clinic_notice' and source_id = p_request and source_revision = '1';
  end if;
  return v_id;
end;
$notice$;

