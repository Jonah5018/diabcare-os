-- No real tenant identifiers or patient row values are returned by these probes.
begin read only;
set local statement_timeout = '5s';

do $verify$
declare
  sample record;
  plan json;
  plans jsonb := '[]'::jsonb;
begin
  if exists (
    select 1 from pg_index i
    join pg_class c on c.oid = i.indexrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not i.indisvalid
  ) then
    raise exception 'Invalid application index found';
  end if;

  for sample in
    select * from (values
      ('patient_search', $sql$
        select id from public.patients
        where organization_id = '00000000-0000-0000-0000-000000000000'::uuid
          and search_text ilike '%synthetic%'
        order by created_at desc nulls last, id desc limit 26
      $sql$),
      ('appointments', $sql$
        select id from public.appointments
        where organization_id = '00000000-0000-0000-0000-000000000000'::uuid
          and appointment_date = current_date
        order by queue_number, id limit 26
      $sql$),
      ('follow_ups', $sql$
        select id from public.follow_ups
        where organization_id = '00000000-0000-0000-0000-000000000000'::uuid
          and status = 'planned'
        order by due_date, id limit 26
      $sql$),
      ('audit', $sql$
        select id from public.audit_events
        where organization_id = '00000000-0000-0000-0000-000000000000'::uuid
        order by created_at desc, id desc limit 26
      $sql$)
    ) as probes(name, statement)
  loop
    execute 'explain (analyze, buffers, format json) ' || sample.statement into plan;
    plans := plans || jsonb_build_array(jsonb_build_object(
      'scenario', sample.name,
      'planning_ms', plan->0->'Planning Time',
      'execution_ms', plan->0->'Execution Time',
      'plan', plan->0->'Plan'
    ));
  end loop;

  perform set_config('diabcare.performance_probes', plans::text, true);
end;
$verify$;

select jsonb_build_object(
  'scope', 'empty-tenant catalog/plan diagnostic; not clinical load or RLS benchmark',
  'connections', (select count(*) from pg_stat_activity where datname = current_database()),
  'waiting_locks', (select count(*) from pg_locks where not granted),
  'unused_public_indexes', (select count(*) from pg_stat_user_indexes where schemaname = 'public' and idx_scan = 0),
  'probes', current_setting('diabcare.performance_probes')::jsonb
) as verification;
rollback;
