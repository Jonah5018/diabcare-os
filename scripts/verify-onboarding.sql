begin;

do $verify$
declare
  clinic uuid := gen_random_uuid();
  foreign_clinic uuid := gen_random_uuid();
  owner uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  staff uuid := gen_random_uuid();
  newcomer uuid := gen_random_uuid();
  unverified uuid := gen_random_uuid();
  bad_email uuid := gen_random_uuid();
  invite jsonb;
  replacement jsonb;
  provision jsonb;
  secret text;
  blocked boolean;
begin
  insert into public.organizations (id, name, slug) values
    (clinic, 'Temporary onboarding test clinic', 'verify-onboarding-' || clinic),
    (foreign_clinic, 'Temporary foreign onboarding clinic', 'verify-onboarding-' || foreign_clinic);
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (owner, owner || '@example.invalid', 'authenticated', 'authenticated', now()),
    (admin, admin || '@example.invalid', 'authenticated', 'authenticated', now()),
    (staff, staff || '@example.invalid', 'authenticated', 'authenticated', now()),
    (newcomer, newcomer || '@example.invalid', 'authenticated', 'authenticated', now()),
    (bad_email, bad_email || '@example.invalid', 'authenticated', 'authenticated', now()),
    (unverified, unverified || '@example.invalid', 'authenticated', 'authenticated', null);
  insert into public.users (id, organization_id, full_name, email, role, is_active) values
    (owner, clinic, 'Synthetic owner', owner || '@example.invalid', 'platform_owner', true),
    (admin, clinic, 'Synthetic administrator', admin || '@example.invalid', 'organization_admin', true),
    (staff, clinic, 'Synthetic doctor', staff || '@example.invalid', 'doctor', true);

  perform set_config('request.jwt.claim.sub', admin::text, true);
  execute 'set local role authenticated';
  blocked := false;
  begin
    perform public.provision_clinic('Denied clinic', 'denied-clinic-' || clinic, newcomer || '@example.invalid', 'Synthetic');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Clinic admin provisioned global clinic'; end if;
  blocked := false;
  begin
    perform public.invite_clinic_staff(foreign_clinic, newcomer || '@example.invalid', 'Synthetic', 'doctor');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Cross-clinic invitation issued'; end if;
  blocked := false;
  begin
    perform public.invite_clinic_staff(clinic, newcomer || '@example.invalid', 'Synthetic', 'platform_owner');
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Platform role invited'; end if;

  invite := public.invite_clinic_staff(clinic, newcomer || '@example.invalid', 'Synthetic invited nurse', 'nurse');
  secret := invite ->> 'token';
  if length(secret) <> 64 then raise exception 'Invitation entropy format invalid'; end if;
  blocked := false;
  begin
    perform token_hash from public.staff_invitations;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Token hash exposed to staff API'; end if;

  perform set_config('request.jwt.claim.sub', bad_email::text, true);
  blocked := false;
  begin
    perform public.accept_staff_invitation(secret);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Different verified email accepted invitation'; end if;
  perform set_config('request.jwt.claim.sub', newcomer::text, true);
  if public.accept_staff_invitation(secret) <> clinic then raise exception 'Valid invitation not accepted'; end if;
  perform public.accept_staff_invitation(secret);
  if not exists (select 1 from public.users where id = newcomer and organization_id = clinic and role = 'nurse' and is_active = true) then
    raise exception 'Stored clinic role not assigned';
  end if;
  blocked := false;
  begin
    update public.users set role = 'platform_owner' where id = newcomer;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Self-assigned role allowed'; end if;

  perform set_config('request.jwt.claim.sub', admin::text, true);
  invite := public.invite_clinic_staff(clinic, unverified || '@example.invalid', 'Synthetic unverified', 'doctor');
  perform set_config('request.jwt.claim.sub', unverified::text, true);
  blocked := false;
  begin
    perform public.accept_staff_invitation(invite ->> 'token');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Unverified email accepted invitation'; end if;
  execute 'reset role';
  update auth.users set email_confirmed_at = now() where id = unverified;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.revoke_staff_invitation((invite ->> 'invitation_id')::uuid);
  perform set_config('request.jwt.claim.sub', unverified::text, true);
  blocked := false;
  begin
    perform public.accept_staff_invitation(invite ->> 'token');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Revoked invitation accepted'; end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  invite := public.invite_clinic_staff(clinic, unverified || '@example.invalid', 'Synthetic', 'doctor');
  execute 'reset role';
  update public.staff_invitations set expires_at = now() - interval '1 second' where id = (invite ->> 'invitation_id')::uuid;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', unverified::text, true);
  blocked := false;
  begin
    perform public.accept_staff_invitation(invite ->> 'token');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Expired invitation accepted'; end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  replacement := public.invite_clinic_staff(clinic, unverified || '@example.invalid', 'Synthetic replacement', 'doctor');
  if not exists (select 1 from public.staff_invitations where id = (invite ->> 'invitation_id')::uuid and status = 'revoked') then
    raise exception 'Replacement did not revoke previous secret';
  end if;

  blocked := false;
  begin
    perform public.set_staff_activity(admin, false);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Self deactivation allowed'; end if;
  blocked := false;
  begin
    perform public.set_staff_activity(owner, false);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Platform owner deactivation allowed'; end if;
  perform public.set_staff_activity(staff, false);
  perform set_config('request.jwt.claim.sub', staff::text, true);
  blocked := false;
  begin
    perform public.invite_clinic_staff(clinic, bad_email || '@example.invalid', 'Synthetic', 'nurse');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Inactive staff administered clinic'; end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.set_staff_activity(staff, true);

  perform set_config('request.jwt.claim.sub', owner::text, true);
  blocked := false;
  begin
    perform public.set_staff_activity(admin, false);
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then raise exception 'Last clinic admin deactivated'; end if;
  provision := public.provision_clinic('Synthetic new clinic', 'verify-created-' || owner, bad_email || '@example.invalid', 'Synthetic first admin');
  if (select organization_id from public.users where id = owner) <> clinic then raise exception 'Current owner reassigned'; end if;
  if not exists (select 1 from public.list_onboarding_clinics() where id = (provision ->> 'organization_id')::uuid) then
    raise exception 'Provisioned clinic unavailable to owner';
  end if;
  perform set_config('request.jwt.claim.sub', bad_email::text, true);
  perform public.accept_staff_invitation(provision ->> 'token');
  if not exists (select 1 from public.users where id = bad_email and role = 'organization_admin') then
    raise exception 'Initial clinic admin missing';
  end if;
  perform set_config('request.jwt.claim.sub', owner::text, true);
  perform public.update_clinic_profile(clinic, 'Synthetic renamed clinic', '', '', 'Synthetic address');
  -- An invitation must not reveal or move an existing foreign membership.
  invite := public.invite_clinic_staff((provision ->> 'organization_id')::uuid,
    newcomer || '@example.invalid', 'Synthetic existing member', 'doctor');
  perform set_config('request.jwt.claim.sub', newcomer::text, true);
  blocked := false;
  begin
    perform public.accept_staff_invitation(invite ->> 'token');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked or (select organization_id from public.users where id = newcomer) <> clinic then
    raise exception 'Existing clinic membership moved';
  end if;
  perform set_config('request.jwt.claim.sub', owner::text, true);
  execute 'reset role';
  if exists (select 1 from public.audit_events where organization_id in (clinic, foreign_clinic)
    and (details::text like '%' || secret || '%' or details::text like '%@example.invalid%')) then
    raise exception 'Administrative audit leaked secrets/contact content';
  end if;
  execute 'set local role anon';
  blocked := false;
  begin
    perform public.accept_staff_invitation(secret);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous invitation acceptance permitted'; end if;
  execute 'reset role';
end;
$verify$;

rollback;
select 'PASS: controlled provisioning, stored-role acceptance, email verification/matching, retry, expiry/revocation/replacement, no role escalation, tenant scope, staff activity, protected last admin, token-hash denial and audit privacy. All fixtures rolled back.' as verification;
