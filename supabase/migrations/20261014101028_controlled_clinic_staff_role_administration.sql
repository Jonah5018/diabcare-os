-- Clinic roles remain predefined; this command never assigns platform authority.
create function private.change_clinic_staff_role(
  p_staff_id uuid,
  p_role public.user_role,
  p_expected_role public.user_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $command$
declare
  v_actor uuid := auth.uid();
  v_clinic uuid;
  v_target public.users%rowtype;
begin
  if p_role is null or p_role not in (
    'organization_admin', 'doctor', 'nurse', 'receptionist', 'lab_scientist'
  ) or p_expected_role is null then
    raise exception using errcode = '22023', message = 'Invalid clinic role';
  end if;

  -- Authenticate authority before looking up another staff identity.
  if not exists (
    select 1 from public.users where id = v_actor and is_active = true
      and role in ('platform_owner', 'organization_admin')
  ) then
    raise exception using errcode = '42501', message = 'Clinic role administration permission required';
  end if;
  select organization_id into v_clinic from public.users where id = p_staff_id;
  if v_clinic is null then
    raise exception using errcode = '42501', message = 'Staff unavailable';
  end if;
  -- Shares the clinic membership lock with activity and invitation acceptance.
  perform private.administration_clinic(v_clinic);
  select * into v_target from public.users
  where id = p_staff_id and organization_id = v_clinic for update;
  if not found or p_staff_id = v_actor or v_target.role = 'platform_owner' then
    raise exception using errcode = '42501', message = 'Protected staff account';
  end if;
  if v_target.role = p_role then return v_target.id; end if;
  if v_target.role <> p_expected_role then
    raise exception using errcode = '40001', message = 'Staff role changed; refresh before retrying';
  end if;
  if v_target.role = 'organization_admin' and v_target.is_active = true
     and p_role <> 'organization_admin' and not exists (
       select 1 from public.users
       where organization_id = v_clinic and id <> p_staff_id
         and role = 'organization_admin' and is_active = true
     ) then
    raise exception using errcode = '22023', message = 'Keep an active clinic administrator';
  end if;

  update public.users set role = p_role where id = v_target.id;
  -- Withdraw delegated onboarding authority when the issuer is demoted.
  if v_target.role = 'organization_admin' and p_role <> 'organization_admin' then
    update public.staff_invitations set status = 'revoked', resolved_at = clock_timestamp()
    where organization_id = v_clinic and invited_by = v_target.id and status = 'pending';
  end if;
  return v_target.id;
end;
$command$;

create function public.change_staff_role(
  p_staff_id uuid,
  p_role public.user_role,
  p_expected_role public.user_role
)
returns uuid
language sql
security invoker
set search_path = ''
as $wrapper$
  select private.change_clinic_staff_role(p_staff_id, p_role, p_expected_role);
$wrapper$;

revoke all on function private.change_clinic_staff_role(uuid, public.user_role, public.user_role)
from public, anon;
revoke all on function public.change_staff_role(uuid, public.user_role, public.user_role)
from public, anon;
grant execute on function private.change_clinic_staff_role(uuid, public.user_role, public.user_role)
to authenticated;
grant execute on function public.change_staff_role(uuid, public.user_role, public.user_role)
to authenticated;

-- The existing audit trigger now records administrative before/after metadata.
-- No contact fields, invitation secrets, hashes or clinical text are copied.
create or replace function private.record_administration_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $audit$
declare
  v_details jsonb := '{}'::jsonb;
  v_clinic uuid;
begin
  v_clinic := case when tg_table_name = 'organizations' then new.id
    else (to_jsonb(new) ->> 'organization_id')::uuid end;
  if v_clinic is null then return new; end if;

  if tg_table_name = 'staff_invitations' then
    v_details := jsonb_build_object('status', new.status);
    if tg_op = 'UPDATE' then
      v_details := v_details || jsonb_build_object('previous_status', old.status);
    end if;
  end if;
  if tg_table_name = 'users' then
    v_details := jsonb_build_object('is_active', new.is_active, 'role', new.role);
    if tg_op = 'UPDATE' then
      v_details := v_details || jsonb_build_object(
        'previous_is_active', old.is_active, 'previous_role', old.role
      );
    end if;
  end if;
  insert into public.audit_events (
    organization_id, actor_id, entity_type, record_id, operation, details
  ) values (v_clinic, auth.uid(), tg_table_name, new.id, tg_op, v_details);
  return new;
end;
$audit$;
revoke all on function private.record_administration_audit() from public, anon, authenticated;


