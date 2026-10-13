create schema if not exists private;

revoke all
on schema private
from public;

grant usage
on schema private
to authenticated;

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select u.organization_id
  from public.users u
  where u.id = (select auth.uid())
    and u.is_active = true
  limit 1;
$function$;

revoke execute
on function private.current_organization_id()
from public, anon;

grant execute
on function private.current_organization_id()
to authenticated;

drop policy if exists "Users can view own profile"
on public.users;

drop policy if exists "Clinic staff can view clinic staff"
on public.users;

create policy "Clinic staff can view clinic staff"
on public.users
for select
to authenticated
using (
  id = (select auth.uid())
  or organization_id =
     (select private.current_organization_id())
);

revoke all privileges
on table public.users
from anon;

grant select
on table public.users
to authenticated;