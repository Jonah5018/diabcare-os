-- Controlled membership commands; no client can assign its own clinic or role.
create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  role public.user_role not null check (role <> 'platform_owner'),
  token_hash text not null unique,
  invited_by uuid not null references public.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  accepted_by uuid references auth.users(id),
  check ((status = 'pending' and resolved_at is null and accepted_by is null)
    or (status = 'accepted' and resolved_at is not null and accepted_by is not null)
    or (status = 'revoked' and resolved_at is not null and accepted_by is null))
);
create unique index staff_invitations_pending_email_idx
  on public.staff_invitations (organization_id, email) where status = 'pending';
create index staff_invitations_history_idx
  on public.staff_invitations (organization_id, created_at desc, id desc);
create index staff_invitations_author_idx on public.staff_invitations (invited_by);
create index staff_invitations_acceptor_idx on public.staff_invitations (accepted_by);
alter table public.staff_invitations enable row level security;
revoke all on public.staff_invitations from public, anon, authenticated;
grant select (id, organization_id, email, full_name, role, invited_by, status, expires_at, created_at, resolved_at)
  on public.staff_invitations to authenticated;
create policy "Clinic administrators read clinic invitations"
on public.staff_invitations for select to authenticated
using (organization_id = (select private.current_organization_id()) and exists (
  select 1 from public.users where id = (select auth.uid()) and is_active = true
    and role in ('organization_admin', 'platform_owner')
));

-- Serialize membership mutations within a clinic, then recheck actor authority.
create function private.administration_clinic(p_clinic uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare v_actor public.users%rowtype; v_clinic uuid;
begin
  select * into v_actor from public.users where id = auth.uid() and is_active = true;
  if not found or v_actor.role not in ('platform_owner', 'organization_admin') then
    raise exception using errcode = '42501', message = 'Clinic administration permission required';
  end if;
  v_clinic := coalesce(p_clinic, v_actor.organization_id);
  if v_clinic is null or (v_actor.role <> 'platform_owner' and v_clinic <> v_actor.organization_id)
     or not exists (select 1 from public.organizations where id = v_clinic) then
    raise exception using errcode = '42501', message = 'Clinic unavailable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('membership:' || v_clinic::text, 0));
  perform 1 from public.users where id = auth.uid() and is_active = true
    and (role = 'platform_owner' or (role = 'organization_admin' and organization_id = v_clinic)) for share;
  if not found then raise exception using errcode = '42501', message = 'Clinic administration permission required'; end if;
  return v_clinic;
end;
$command$;

create function private.issue_staff_invitation(p_clinic uuid, p_email text, p_name text, p_role public.user_role)
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
  if exists (select 1 from public.users where lower(email) = v_email) then
    raise exception using errcode = '22023', message = 'Email already has a clinic profile';
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

create function public.invite_clinic_staff(p_clinic uuid, p_email text, p_name text, p_role public.user_role)
returns jsonb language sql security invoker set search_path = ''
as $wrapper$ select private.issue_staff_invitation(p_clinic, p_email, p_name, p_role); $wrapper$;

create function private.provision_clinic(p_name text, p_slug text, p_admin_email text, p_admin_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $command$
declare v_clinic uuid;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_active = true and role = 'platform_owner') then
    raise exception using errcode = '42501', message = 'Platform owner permission required';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 200
     or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 3 and 80 then
    raise exception using errcode = '22023', message = 'Invalid clinic profile';
  end if;
  insert into public.organizations (name, slug) values (btrim(p_name), p_slug) returning id into v_clinic;
  return private.issue_staff_invitation(v_clinic, p_admin_email, p_admin_name, 'organization_admin');
end;
$command$;

create function public.provision_clinic(p_name text, p_slug text, p_admin_email text, p_admin_name text)
returns jsonb language sql security invoker set search_path = ''
as $wrapper$ select private.provision_clinic(p_name, p_slug, p_admin_email, p_admin_name); $wrapper$;

create function private.accept_staff_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare v_actor uuid := auth.uid(); v_email text; v_invite public.staff_invitations%rowtype;
begin
  if v_actor is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '42501', message = 'Invitation unavailable';
  end if;
  select lower(email) into v_email from auth.users where id = v_actor
    and email_confirmed_at is not null and is_anonymous is not true for share;
  if v_email is null then raise exception using errcode = '42501', message = 'Verified email required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile:' || v_actor::text, 0));
  select * into v_invite from public.staff_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception using errcode = '42501', message = 'Invitation unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('membership:' || v_invite.organization_id::text, 0));
  select * into v_invite from public.staff_invitations where id = v_invite.id for update;
  if v_invite.email <> v_email then raise exception using errcode = '42501', message = 'Invitation unavailable'; end if;
  if v_invite.status = 'accepted' and v_invite.accepted_by = v_actor then return v_invite.organization_id; end if;
  if v_invite.status <> 'pending' or v_invite.expires_at <= clock_timestamp()
    or exists (select 1 from public.users where id = v_actor)
    or not exists (select 1 from public.users where id = v_invite.invited_by and is_active = true
      and (role = 'platform_owner' or (role = 'organization_admin' and organization_id = v_invite.organization_id))) then
    raise exception using errcode = '42501', message = 'Invitation unavailable';
  end if;
  insert into public.users (id, organization_id, full_name, email, role, is_active)
  values (v_actor, v_invite.organization_id, v_invite.full_name, v_email, v_invite.role, true);
  update public.staff_invitations set status = 'accepted', accepted_by = v_actor, resolved_at = clock_timestamp()
  where id = v_invite.id;
  return v_invite.organization_id;
end;
$command$;

create function public.accept_staff_invitation(p_token text)
returns uuid language sql security invoker set search_path = ''
as $wrapper$ select private.accept_staff_invitation(p_token); $wrapper$;

create function private.revoke_staff_invitation(p_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare v_clinic uuid;
begin
  select organization_id into v_clinic from public.staff_invitations where id = p_id;
  if v_clinic is null then raise exception using errcode = '42501', message = 'Invitation unavailable'; end if;
  perform private.administration_clinic(v_clinic);
  if exists (select 1 from public.staff_invitations where id = p_id and status = 'accepted') then
    raise exception using errcode = '22023', message = 'Accepted invitations cannot be revoked';
  end if;
  update public.staff_invitations set status = 'revoked', resolved_at = clock_timestamp()
  where id = p_id and status = 'pending';
  return p_id;
end;
$command$;
create function public.revoke_staff_invitation(p_id uuid)
returns uuid language sql security invoker set search_path = ''
as $wrapper$ select private.revoke_staff_invitation(p_id); $wrapper$;

create function private.set_staff_activity(p_id uuid, p_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare v_clinic uuid; v_target public.users%rowtype;
begin
  select organization_id into v_clinic from public.users where id = p_id;
  if v_clinic is null or p_active is null then raise exception using errcode = '42501', message = 'Staff unavailable'; end if;
  perform private.administration_clinic(v_clinic);
  select * into v_target from public.users where id = p_id for update;
  if p_id = auth.uid() or v_target.role = 'platform_owner' then
    raise exception using errcode = '42501', message = 'Protected account';
  end if;
  if not p_active and v_target.role = 'organization_admin' and not exists (
    select 1 from public.users where organization_id = v_clinic and id <> p_id and role = 'organization_admin' and is_active = true
  ) then raise exception using errcode = '22023', message = 'Keep an active clinic administrator'; end if;
  update public.users set is_active = p_active where id = p_id;
  return p_id;
end;
$command$;
create function public.set_staff_activity(p_id uuid, p_active boolean)
returns uuid language sql security invoker set search_path = ''
as $wrapper$ select private.set_staff_activity(p_id, p_active); $wrapper$;

create function private.update_clinic_profile(p_clinic uuid, p_name text, p_email text, p_phone text, p_address text)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare v_clinic uuid;
begin
  v_clinic := private.administration_clinic(p_clinic);
  if p_name is null or length(btrim(p_name)) not between 1 and 200
     or length(coalesce(p_email, '')) > 254 or length(coalesce(p_phone, '')) > 40
     or length(coalesce(p_address, '')) > 500 then
    raise exception using errcode = '22023', message = 'Invalid clinic profile';
  end if;
  update public.organizations set name = btrim(p_name), email = nullif(btrim(p_email), ''),
    phone = nullif(btrim(p_phone), ''), address = nullif(btrim(p_address), ''), updated_at = clock_timestamp()
  where id = v_clinic;
  return v_clinic;
end;
$command$;
create function public.update_clinic_profile(p_clinic uuid, p_name text, p_email text, p_phone text, p_address text)
returns uuid language sql security invoker set search_path = ''
as $wrapper$ select private.update_clinic_profile(p_clinic, p_name, p_email, p_phone, p_address); $wrapper$;

-- Platform listing grants only clinic identities and invitation summaries.
create function private.list_onboarding_clinics(p_after uuid default null)
returns table(id uuid, name text, slug text) language plpgsql stable security definer set search_path = ''
as $command$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.is_active = true and u.role = 'platform_owner') then
    raise exception using errcode = '42501', message = 'Platform owner permission required';
  end if;
  return query select o.id, o.name, o.slug from public.organizations o
  where p_after is null or o.id > p_after order by o.id limit 26;
end;
$command$;
create function public.list_onboarding_clinics(p_after uuid default null)
returns table(id uuid, name text, slug text) language sql security invoker set search_path = ''
as $wrapper$ select * from private.list_onboarding_clinics(p_after); $wrapper$;

revoke insert, update, delete on public.users, public.organizations from public, anon, authenticated;

-- Administrative audit contains no email, profile content, secret or token hash.
alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type in ('patients', 'appointments', 'consultations', 'vitals', 'laboratory_results',
    'prescriptions', 'prescription_items', 'follow_ups', 'staff_invitations', 'organizations', 'users')
);
create function private.record_administration_audit()
returns trigger language plpgsql security definer set search_path = ''
as $audit$
declare v_details jsonb := '{}'::jsonb; v_clinic uuid;
begin
  v_clinic := case when tg_table_name = 'organizations' then new.id else (to_jsonb(new) ->> 'organization_id')::uuid end;
  if v_clinic is null then return new; end if;
  if tg_table_name = 'staff_invitations' then v_details := jsonb_build_object('status', new.status); end if;
  if tg_table_name = 'users' then v_details := jsonb_build_object('is_active', new.is_active, 'role', new.role); end if;
  insert into public.audit_events (organization_id, actor_id, entity_type, record_id, operation, details)
  values (v_clinic, auth.uid(), tg_table_name, new.id, tg_op, v_details);
  return new;
end;
$audit$;
revoke all on function private.record_administration_audit() from public, anon, authenticated;
create trigger invitations_administration_audit after insert or update on public.staff_invitations
for each row execute function private.record_administration_audit();
create trigger users_administration_audit after insert or update on public.users
for each row execute function private.record_administration_audit();
create trigger organizations_administration_audit after insert or update on public.organizations
for each row execute function private.record_administration_audit();

create function private.list_clinic_invitations(p_clinic uuid, p_before_time timestamptz default null, p_before_id uuid default null)
returns table(id uuid, email text, full_name text, role public.user_role, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $command$
declare v_clinic uuid;
begin
  v_clinic := private.administration_clinic(p_clinic);
  return query select i.id, i.email, i.full_name, i.role, i.status, i.created_at, i.expires_at
  from public.staff_invitations i where i.organization_id = v_clinic
    and (p_before_id is null or (i.created_at, i.id) < (p_before_time, p_before_id))
  order by i.created_at desc, i.id desc limit 26;
end;
$command$;
create function public.list_clinic_invitations(p_clinic uuid, p_before_time timestamptz default null, p_before_id uuid default null)
returns table(id uuid, email text, full_name text, role public.user_role, status text, created_at timestamptz, expires_at timestamptz)
language sql security invoker set search_path = ''
as $wrapper$ select * from private.list_clinic_invitations(p_clinic, p_before_time, p_before_id); $wrapper$;

-- New functions never inherit PUBLIC execution.
do $grants$
declare v_function record;
begin
  for v_function in select p.oid::regprocedure as signature
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.proname in (
    'administration_clinic', 'issue_staff_invitation', 'invite_clinic_staff', 'provision_clinic',
    'accept_staff_invitation', 'revoke_staff_invitation', 'set_staff_activity', 'update_clinic_profile', 'list_onboarding_clinics', 'list_clinic_invitations'
  ) loop
    execute format('revoke all on function %s from public, anon', v_function.signature);
    execute format('grant execute on function %s to authenticated', v_function.signature);
  end loop;
end;
$grants$;


