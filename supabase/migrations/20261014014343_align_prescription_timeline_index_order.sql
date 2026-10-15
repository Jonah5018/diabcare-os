-- Plan each event-kind query with a literal kind so PostgreSQL can prune
-- other UNION branches and read an ordered index before applying its limit.
-- All identity/cursor values stay bound; the only formatted value is quoted.
create or replace function private.patient_timeline_slice(
  p_patient_id uuid,
  p_event_kind text,
  p_cursor_time timestamptz,
  p_cursor_kind text,
  p_cursor_id uuid,
  p_limit integer
)
returns setof public.patient_timeline_events
language plpgsql
stable
security invoker
set search_path = ''
as $slice$
begin
  return query execute format(
    $query$
      select event.*
      from public.patient_timeline_events event
      where event.patient_id = $1
        and event.organization_id = (select private.current_organization_id())
        and event.event_kind = %L
        and (
          $4 is null
          or (
            $2 is not null
            and (
              event.occurred_at < $2
              or event.occurred_at is null
              or (
                event.occurred_at = $2
                and (event.event_kind, event.source_id) < ($3 collate "C", $4)
              )
            )
          )
          or (
            $2 is null
            and event.occurred_at is null
            and (event.event_kind, event.source_id) < ($3 collate "C", $4)
          )
        )
      order by event.occurred_at desc %s, event.source_id desc
      limit least(greatest(coalesce($5, 26), 1), 26)
    $query$,
    p_event_kind,
    -- Prescription timestamps are NOT NULL; this matches their existing indexes.
    case when p_event_kind like 'prescription_%' then 'nulls first' else 'nulls last' end
  ) using p_patient_id, p_cursor_time, p_cursor_kind, p_cursor_id, p_limit;
end;
$slice$;


