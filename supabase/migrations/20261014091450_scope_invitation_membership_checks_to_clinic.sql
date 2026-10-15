-- Avoid revealing another clinic's membership through invitation issuance.
create or replace function private.issue_staff_invitation(p_clinic uuid, p_email text, p_name text, p_role public.user_role)
returns jsonb language plpgsql security definer set search_path = ''
as $command$
declare v_clinic uuid; v_email text := lower(btrim(p_email)); v_token text; v_id uuid;
begin
  v_clinic := private.administration_clinic(p_clinic);
  if p_role is null or p_role = 'platform_owner' or v_email is null
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254
     or p_name is null or length(btrim(p_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Invalid staff invitation';
  end if;
  if exists (select 1 from public.users where lower(email) = v_email and organization_id = v_clinic) then
    raise exception using errcode = '22023', message = 'Email already has a profile in this clinic';
  end if;
  -- A replacement revokes the old pending secret, including expired invitations.
  update public.staff_invitations set status = 'revoked', resolved_at = clock_timestamp()
  where organization_id = v_clinic and email = v_email and status = 'pending';
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.staff_invitations (organization_id, email, full_name, role, token_hash, invited_by)
  values (v_clinic, v_email, btrim(p_name), p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid()) returning id into v_id;
  return jsonb_build_object('invitation_id', v_id, 'organization_id', v_clinic, 'token', v_token);
end;
$command$;


