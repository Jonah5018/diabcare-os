begin;
do $verify$
declare
  clinic uuid := gen_random_uuid();
  reconciliation_clinic uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  blocked boolean;
  entitlement jsonb;
begin
  insert into public.organizations (id, name, slug) values (clinic, 'Temporary billing clinic', 'verify-billing-' || clinic);
  insert into public.organizations (id, name, slug) values (reconciliation_clinic, 'Temporary reconciliation clinic', 'verify-billing-' || reconciliation_clinic);
  insert into auth.users (id, email, aud, role) values (actor, actor || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active)
    values (actor, clinic, 'Synthetic owner', actor || '@example.invalid', 'platform_owner', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  entitlement := public.get_clinic_entitlements();
  if public.current_clinic_feature(null) then raise exception 'Missing feature name granted'; end if;
  if entitlement->>'legacy_access' <> 'true' or entitlement->'features'->>'storage' <> 'true' then
    raise exception 'Existing clinic compatibility failed';
  end if;
  perform public.bind_billing_account('stripe', clinic, 'cus_Synthetic', 'sub_Synthetic');
  blocked := false;
  begin perform public.ingest_billing_webhook('stripe', 'evtSynthetic', repeat('a',64), 'cus_Synthetic', 'sub_Synthetic', 'plus', 'active', 100, null, null);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Browser role submitted payment state'; end if;
  execute 'reset role';
  execute 'set local role service_role';
  if public.ingest_billing_webhook('stripe', 'evtSynthetic', repeat('a',64), 'cus_Synthetic', 'sub_Synthetic', 'plus', 'active', 100, null, null) <> 'applied' then
    raise exception 'Trusted provider event failed';
  end if;
  if public.ingest_billing_webhook('stripe', 'evtSynthetic', repeat('a',64), 'cus_Synthetic', 'sub_Synthetic', 'plus', 'active', 100, null, null) <> 'applied' then
    raise exception 'Duplicate provider event not idempotent';
  end if;
  blocked := false;
  begin perform public.ingest_billing_webhook('stripe', 'evtSynthetic', repeat('b',64), 'cus_Synthetic', 'sub_Synthetic', 'plus', 'active', 100, null, null);
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Event ID payload mismatch accepted'; end if;
  if public.ingest_billing_webhook('stripe', 'evtOld', repeat('b',64), 'cus_Synthetic', 'sub_Synthetic', 'core', 'cancelled', 99, null, null) <> 'ignored_stale' then
    raise exception 'Out-of-order event changed current state';
  end if;
  if public.ingest_billing_webhook('stripe', 'evtEqual', repeat('c',64), 'cus_Synthetic', 'sub_Synthetic', 'core', 'cancelled', 100, null, null) <> 'needs_reconciliation' then
    raise exception 'Conflicting equal-time event applied';
  end if;
  if public.ingest_billing_webhook('stripe', 'evtUnknown', repeat('d',64), 'cus_Unknown', 'sub_Unknown', 'plus', 'active', 101, null, null) <> 'unmatched' then
    raise exception 'Unknown account acquired entitlements';
  end if;
  perform public.ingest_billing_webhook('stripe', 'evtPastDue', repeat('e',64), 'cus_Synthetic', 'sub_Synthetic', 'plus', 'past_due', 102, null, null);
  execute 'reset role';
  execute 'set local role authenticated';
  perform public.bind_billing_account('stripe', reconciliation_clinic, 'cus_Unknown', 'sub_Unknown');
  execute 'reset role';
  execute 'set local role service_role';
  if public.ingest_billing_webhook('stripe', 'evtUnknown', repeat('d',64), 'cus_Unknown', 'sub_Unknown', 'plus', 'active', 101, null, null) <> 'applied' then
    raise exception 'Verified unmatched event could not reconcile after binding';
  end if;
  execute 'reset role';
  execute 'set local role authenticated';
  if public.current_clinic_feature('storage') or public.current_clinic_feature('communications') then
    raise exception 'Past-due subscription acquired optional features';
  end if;
  blocked := false;
  begin update public.organization_subscriptions set status = 'active';
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Direct payment status mutation permitted'; end if;
  blocked := false;
  begin perform public.get_clinic_operational_report(current_date, current_date);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Report entitlement bypassed via RPC'; end if;
  execute 'reset role';
end;
$verify$;
rollback;
select 'PASS: legacy access, controlled account binding, trusted-only billing ingest, event idempotency/hash conflicts, stale/equal-time/unmatched reconciliation and database entitlement denial. Fixtures rolled back.' as verification;
