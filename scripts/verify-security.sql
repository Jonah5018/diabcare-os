begin read only;

do $verify$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (
        not c.relrowsecurity
        or has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
        or has_table_privilege('authenticated', c.oid, 'TRUNCATE,TRIGGER,REFERENCES')
      )
  ) then
    raise exception 'Application RLS or browser table privilege regression';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or not coalesce('search_path=""' = any(p.proconfig), false)
          and not (n.nspname = 'public' and p.proname = 'rls_auto_enable'
            and coalesce('search_path=pg_catalog' = any(p.proconfig), false))
      )
  ) then
    raise exception 'Privileged function execution/search-path regression';
  end if;

  if has_column_privilege('authenticated', 'public.staff_invitations', 'token_hash', 'SELECT')
    or has_column_privilege('authenticated', 'public.notification_events', 'lease_token', 'SELECT')
    or has_table_privilege('authenticated', 'private.billing_account_links', 'SELECT')
    or has_table_privilege('authenticated', 'private.billing_webhook_events', 'SELECT') then
    raise exception 'Private token or backend billing record exposed';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('UPDATE', 'DELETE') and policyname ilike '%clinical%'
  ) then
    raise exception 'Unexpected clinical object overwrite/delete policy';
  end if;
end;
$verify$;

rollback;
select 'PASS: RLS, anonymous/DDL privilege denial, privileged search paths, token/billing privacy and clinical Storage policy checks.' as verification;
