begin;
do $verify$
declare
  clinic uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  foreign_patient uuid := gen_random_uuid();
  blocked boolean;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary owner clinic', 'verify-owner-' || clinic),
    (other, 'Temporary managed clinic', 'verify-owner-' || other);
  insert into auth.users (id, email, aud, role) values
    (owner_id, owner_id || '@example.invalid', 'authenticated', 'authenticated'),
    (admin_id, admin_id || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (owner_id, clinic, 'Synthetic owner', owner_id || '@example.invalid', 'platform_owner', true),
    (admin_id, other, 'Synthetic admin', admin_id || '@example.invalid', 'organization_admin', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name)
    values (foreign_patient, other, 'VERIFY-ADMIN-' || foreign_patient, 'Synthetic', 'Patient');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role authenticated';
  if not exists (select 1 from public.platform_organizations() where id = other) then raise exception 'Global directory unavailable'; end if;
  if exists (select 1 from public.patients where id = foreign_patient) then raise exception 'Owner gained global clinical reads'; end if;
  if public.platform_clinic_details(other)->>'patient_count' <> '1' then raise exception 'Aggregate support metadata failed'; end if;
  perform public.set_clinic_operational_status(other, 'suspended', 'active', 'security_review');
  if not exists (select 1 from public.platform_audit_events where organization_id = other
    and actor_id = owner_id and previous_status = 'active' and status = 'suspended') then
    raise exception 'Global status mutation not audited';
  end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if public.get_clinic_workspace_status() <> 'suspended' then raise exception 'Suspended status unavailable'; end if;
  if exists (select 1 from public.patients where id = foreign_patient) then raise exception 'Suspended clinic clinical read permitted'; end if;
  blocked := false;
  begin insert into public.appointments (organization_id, patient_id, appointment_date, status, created_by)
    values (other, foreign_patient, current_date, 'scheduled', admin_id);
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Suspended clinic clinical write permitted'; end if;
  blocked := false;
  begin perform public.platform_overview();
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Clinic admin gained global administration'; end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  blocked := false;
  begin perform public.set_clinic_operational_status(other, 'active', 'active', 'resolved');
  exception when serialization_failure then blocked := true; end;
  if not blocked then raise exception 'Stale clinic status accepted'; end if;
  perform public.set_clinic_operational_status(other, 'active', 'suspended', 'resolved');
  perform public.set_clinic_operational_status(clinic, 'suspended', 'active', 'operational_review');
  if not exists (select 1 from public.platform_organizations() where id = clinic) then raise exception 'Owner lost independent recovery surface'; end if;
  perform public.set_clinic_operational_status(clinic, 'active', 'suspended', 'resolved');
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if not exists (select 1 from public.patients where id = foreign_patient) then raise exception 'Restored clinic history lost'; end if;
  if exists (select 1 from public.platform_audit_events) then raise exception 'Clinic admin read platform audit'; end if;
  execute 'reset role';
end;
$verify$;
rollback;
select 'PASS: deliberate owner metadata scope, preserved clinical isolation, audited/stale-safe suspension, database read/write denial, owner recovery and retained clinical history. Fixtures rolled back.' as verification;
