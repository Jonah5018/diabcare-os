-- Synthetic audit events and retention drafts are transaction-local.
begin;
do $verify$
declare
  clinic uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  foreign_admin uuid := gen_random_uuid();
  event_id uuid;
  blocked boolean;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary audit clinic', 'verify-audit-' || clinic),
    (other, 'Temporary foreign audit clinic', 'verify-audit-' || other);
  insert into auth.users (id, email, aud, role) values
    (admin, admin || '@example.invalid', 'authenticated', 'authenticated'),
    (foreign_admin, foreign_admin || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (admin, clinic, 'Synthetic admin', admin || '@example.invalid', 'organization_admin', true),
    (foreign_admin, other, 'Synthetic foreign admin', foreign_admin || '@example.invalid', 'organization_admin', true);
  perform set_config('request.jwt.claim.sub', admin::text, true);
  execute 'set local role authenticated';
  perform public.save_audit_retention_draft(365, true);
  perform public.save_audit_retention_draft(null, false);
  if not exists (select 1 from public.audit_retention_settings where organization_id = clinic
    and retention_days is null and not legal_hold and not deletion_enabled and archive_required) then
    raise exception 'Retention draft defaults or updates failed';
  end if;
  event_id := public.record_audit_export_request(current_date - 1, current_date, 200);
  if not exists (select 1 from public.audit_events where id = event_id and actor_id = admin
    and organization_id = clinic and operation = 'EXPORT' and entity_type = 'audit_events'
    and details->>'stage' = 'requested' and details->>'row_count' = '200') then
    raise exception 'Export request attribution failed';
  end if;
  if exists (select 1 from public.audit_events where organization_id = other) then
    raise exception 'Foreign audit exposed';
  end if;
  blocked := false;
  begin perform public.record_audit_export_request(current_date - 31, current_date, 1);
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Unbounded date export accepted'; end if;
  blocked := false;
  begin perform public.record_audit_export_request(current_date, current_date, 201);
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Unbounded row export accepted'; end if;
  blocked := false;
  begin update public.audit_retention_settings set deletion_enabled = true;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Direct retention write permitted'; end if;
  blocked := false;
  begin delete from public.audit_events where id = event_id;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Audit deletion permitted'; end if;
  execute 'reset role';
  update public.users set role = 'doctor' where id = admin;
  execute 'set local role authenticated';
  if exists (select 1 from public.audit_retention_settings) or exists (select 1 from public.audit_events) then
    raise exception 'Doctor read administration history';
  end if;
  blocked := false;
  begin perform public.save_audit_retention_draft(365, true);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Doctor edited retention'; end if;
  blocked := false;
  begin perform public.record_audit_export_request(current_date, current_date, 1);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Doctor exported audit'; end if;
  execute 'reset role';
end;
$verify$;
rollback;
select 'PASS: tenant/role audit isolation, guarded bounded export attribution, audited retention drafts and disabled direct writes/deletion. Fixtures rolled back.' as verification;
