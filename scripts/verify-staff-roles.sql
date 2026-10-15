-- Every synthetic profile, invitation and clinical record rolls back.
begin;

do $verify$
declare
  clinic uuid := gen_random_uuid();
  foreign_clinic uuid := gen_random_uuid();
  owner uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  target uuid := gen_random_uuid();
  foreign_staff uuid := gen_random_uuid();
  recipient uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  consultation uuid;
  invitation jsonb;
  blocked boolean;
  before_audits bigint;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary role test clinic', 'verify-roles-' || clinic),
    (foreign_clinic, 'Temporary foreign role clinic', 'verify-roles-' || foreign_clinic);
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (owner, owner || '@example.invalid', 'authenticated', 'authenticated', now()),
    (admin, admin || '@example.invalid', 'authenticated', 'authenticated', now()),
    (target, target || '@example.invalid', 'authenticated', 'authenticated', now()),
    (foreign_staff, foreign_staff || '@example.invalid', 'authenticated', 'authenticated', now()),
    (recipient, recipient || '@example.invalid', 'authenticated', 'authenticated', now());
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (owner, clinic, 'Synthetic owner', owner || '@example.invalid', 'platform_owner', true),
    (admin, clinic, 'Synthetic admin', admin || '@example.invalid', 'organization_admin', true),
    (target, clinic, 'Synthetic doctor', target || '@example.invalid', 'doctor', true),
    (foreign_staff, foreign_clinic, 'Synthetic foreign admin', foreign_staff || '@example.invalid', 'organization_admin', true);
  insert into public.patients (id, organization_id, hospital_number, first_name, last_name)
  values (patient, clinic, 'VERIFY-ROLE-' || patient, 'Synthetic', 'Patient');

  perform set_config('request.jwt.claim.sub', target::text, true);
  execute 'set local role authenticated';
  insert into public.consultations (patient_id, organization_id, doctor_id)
  values (patient, clinic, target) returning id into consultation;
  blocked := false;
  begin
    perform public.change_staff_role(admin, 'doctor', 'organization_admin');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Doctor administered staff roles'; end if;

  perform set_config('request.jwt.claim.sub', admin::text, true);
  blocked := false;
  begin
    perform public.change_staff_role(target, 'platform_owner', 'doctor');
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Platform authority assigned'; end if;
  blocked := false;
  begin
    perform public.change_staff_role(admin, 'doctor', 'organization_admin');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Self role changed'; end if;
  blocked := false;
  begin
    perform public.change_staff_role(owner, 'doctor', 'platform_owner');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Platform owner role changed'; end if;
  blocked := false;
  begin
    perform public.change_staff_role(foreign_staff, 'nurse', 'organization_admin');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Foreign clinic staff modified'; end if;

  perform public.change_staff_role(target, 'nurse', 'doctor');
  if not exists (select 1 from public.users where id = target and role = 'nurse'
      and organization_id = clinic and is_active = true) then raise exception 'Valid role change failed'; end if;
  if not exists (select 1 from public.consultations where id = consultation and doctor_id = target) then
    raise exception 'Role change corrupted historical clinical records';
  end if;
  select count(*) into before_audits from public.audit_events where record_id = target;
  perform public.change_staff_role(target, 'nurse', 'doctor');
  if (select count(*) from public.audit_events where record_id = target) <> before_audits then
    raise exception 'Idempotent retry produced another update';
  end if;
  blocked := false;
  begin
    perform public.change_staff_role(target, 'receptionist', 'doctor');
  exception when serialization_failure then blocked := true;
  end;
  if not blocked then raise exception 'Stale expected role overwrote a change'; end if;
  if not exists (select 1 from public.audit_events where record_id = target
    and details ->> 'previous_role' = 'doctor' and details ->> 'role' = 'nurse') then
    raise exception 'Role audit before/after metadata missing';
  end if;

  perform set_config('request.jwt.claim.sub', target::text, true);
  blocked := false;
  begin
    insert into public.consultations (patient_id, organization_id, doctor_id)
    values (patient, clinic, target);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Demoted doctor retained consultation writing permission'; end if;
  insert into public.vitals (patient_id, organization_id, recorded_by)
  values (patient, clinic, target);
  blocked := false;
  begin
    update public.users set role = 'platform_owner' where id = target;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Direct profile role escalation allowed'; end if;

  perform set_config('request.jwt.claim.sub', owner::text, true);
  blocked := false;
  begin
    perform public.change_staff_role(admin, 'doctor', 'organization_admin');
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Last active administrator demoted'; end if;
  perform public.change_staff_role(target, 'organization_admin', 'nurse');
  perform set_config('request.jwt.claim.sub', target::text, true);
  invitation := public.invite_clinic_staff(clinic, recipient || '@example.invalid', 'Synthetic recipient', 'nurse');
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.change_staff_role(target, 'doctor', 'organization_admin');
  if not exists (select 1 from public.staff_invitations
    where id = (invitation ->> 'invitation_id')::uuid and status = 'revoked') then
    raise exception 'Demotion left delegated invitation live';
  end if;
  perform set_config('request.jwt.claim.sub', recipient::text, true);
  blocked := false;
  begin
    perform public.accept_staff_invitation(invitation ->> 'token');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Demoted issuer invitation accepted'; end if;
  perform set_config('request.jwt.claim.sub', target::text, true);
  blocked := false;
  begin
    perform public.change_staff_role(admin, 'nurse', 'organization_admin');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Demoted administrator retained role commands'; end if;

  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.set_staff_activity(target, false);
  perform public.change_staff_role(target, 'lab_scientist', 'doctor');
  if not exists (select 1 from public.users where id = target and is_active = false and role = 'lab_scientist') then
    raise exception 'Changing an inactive staff role reactivated them';
  end if;
  perform set_config('request.jwt.claim.sub', target::text, true);
  blocked := false;
  begin
    perform public.change_staff_role(admin, 'doctor', 'organization_admin');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Inactive staff changed roles'; end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.set_staff_activity(target, true);
  if not exists (select 1 from public.audit_events where record_id = target
    and details ->> 'previous_is_active' = 'false' and details ->> 'is_active' = 'true') then
    raise exception 'Activity audit before/after metadata missing';
  end if;
  if exists (select 1 from public.audit_events where organization_id = clinic
    and (details::text like '%@example.invalid%' or details::text like '%' || (invitation ->> 'token') || '%')) then
    raise exception 'Audit leaked contact or invitation content';
  end if;
  execute 'reset role';
  execute 'set local role anon';
  blocked := false;
  begin
    perform public.change_staff_role(target, 'doctor', 'lab_scientist');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous role command permitted'; end if;
  execute 'reset role';
end;
$verify$;

rollback;
select 'PASS: clinic role administration, actor/tenant/owner/self guards, last-admin protection, stale/idempotent requests, fresh clinical/administration permissions, retained history/activity, revoked delegation, audit privacy and anonymous denial. All fixtures rolled back.' as verification;
