begin;
do $verify$
declare
  clinic uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  blocked boolean;
  metrics jsonb;
begin
  insert into public.organizations (id, name, slug) values (clinic, 'Temporary operations clinic', 'verify-operations-' || clinic);
  insert into auth.users (id, email, aud, role) values (actor, actor || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active)
    values (actor, clinic, 'Synthetic owner', actor || '@example.invalid', 'platform_owner', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  metrics := public.platform_operations_snapshot();
  if not metrics ? 'failed_notifications' or not metrics ? 'billing_reconciliation' or metrics ? 'patient_id' then
    raise exception 'Operational metadata contract failed';
  end if;
  blocked := false;
  begin perform public.operations_readiness_probe();
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Public staff called backend probe'; end if;
  blocked := false;
  begin perform lease_token from public.notification_events limit 1;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Ordinary table read exposed lease credentials'; end if;
  execute 'reset role';
  update public.users set role = 'organization_admin' where id = actor;
  execute 'set local role authenticated';
  blocked := false;
  begin perform public.platform_operations_snapshot();
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Clinic admin gained global diagnostics'; end if;
  execute 'reset role';
  execute 'set local role service_role';
  if public.operations_readiness_probe()->>'database' <> 'ok' then raise exception 'Backend probe failed'; end if;
  execute 'reset role';
end;
$verify$;
rollback;
select 'PASS: owner-only aggregate operational diagnostics, no clinical metadata, trusted-only database/schema readiness probe. Fixtures rolled back.' as verification;
