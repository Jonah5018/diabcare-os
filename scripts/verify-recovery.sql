begin read only;

do $verify$
declare
  required_table text;
begin
  foreach required_table in array array[
    'organizations', 'users', 'patients', 'appointments', 'vitals',
    'consultations', 'laboratory_results', 'prescriptions', 'prescription_items',
    'follow_ups', 'clinical_documents', 'audit_events', 'staff_invitations',
    'notification_events', 'notification_attempts', 'notification_inbox',
    'organization_subscriptions', 'billing_plans', 'platform_audit_events',
    'audit_retention_settings'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_table
        and c.relkind = 'r'
        and c.relrowsecurity
    ) then
      raise exception 'Required table missing or RLS disabled: %', required_table;
    end if;
  end loop;

  if not exists (
    select 1 from storage.buckets
    where id = 'clinical-documents'
      and public = false
      and file_size_limit = 786432
      and allowed_mime_types @> array['application/pdf', 'image/png', 'image/jpeg']::text[]
      and cardinality(allowed_mime_types) = 3
  ) then
    raise exception 'Private document bucket configuration is missing or changed';
  end if;

  if to_regclass('auth.users') is null or to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'Auth or migration history missing';
  end if;

  if has_table_privilege('authenticated', 'public.audit_events', 'DELETE')
    or has_table_privilege('authenticated', 'public.organization_subscriptions', 'UPDATE')
    or has_table_privilege('anon', 'public.clinical_documents', 'SELECT') then
    raise exception 'Recovery changed a protected table grant';
  end if;
end;
$verify$;

rollback;
select 'PASS: read-only recovery schema/RLS/bucket/grant checks. No backup or restore drill claimed.' as verification;
