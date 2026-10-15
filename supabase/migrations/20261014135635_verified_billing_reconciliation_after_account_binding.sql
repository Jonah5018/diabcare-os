-- Verified unmatched events may be retried after controlled account binding.
-- The original event ID/hash remains immutable; no direct browser access.
create or replace function public.ingest_billing_webhook(
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
    if v_existing.result <> 'unmatched' then return v_existing.result; end if;
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
    values (p_provider, p_event, p_hash, v_clinic, v_result)
    on conflict (provider, event_id) do update set organization_id = excluded.organization_id, result = excluded.result;
  return v_result;
end;
$webhook$;
grant update (organization_id, result) on private.billing_webhook_events to service_role;

