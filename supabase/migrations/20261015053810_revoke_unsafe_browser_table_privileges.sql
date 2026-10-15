-- RLS does not protect TRUNCATE. Browser roles need no table-owner privileges.
-- Preserve authenticated SELECT/INSERT/UPDATE grants and every existing policy.
do $migration$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'appointments', 'audit_events', 'audit_retention_settings', 'billing_plans',
    'clinical_documents', 'consultations', 'follow_ups', 'laboratory_results',
    'notification_attempts', 'notification_events', 'notification_inbox',
    'organization_subscriptions', 'organizations', 'patients',
    'platform_audit_events', 'prescription_items', 'prescriptions',
    'staff_invitations', 'users', 'vitals'
  ] loop
    execute format('revoke all privileges on table public.%I from public, anon', relation_name);
    execute format('revoke truncate, references, trigger on table public.%I from authenticated', relation_name);
  end loop;
end;
$migration$;
