-- Plan each event-kind query with a literal kind so PostgreSQL can prune
-- other UNION branches and read an ordered index before applying its limit.
-- All identity/cursor values stay bound; the only formatted value is quoted.
create function private.patient_timeline_slice(
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
      order by event.occurred_at desc nulls last, event.source_id desc
      limit least(greatest(coalesce($5, 26), 1), 26)
    $query$,
    p_event_kind
  ) using p_patient_id, p_cursor_time, p_cursor_kind, p_cursor_id, p_limit;
end;
$slice$;

revoke all on function private.patient_timeline_slice(uuid, text, timestamptz, text, uuid, integer)
from public, anon;
grant execute on function private.patient_timeline_slice(uuid, text, timestamptz, text, uuid, integer)
to authenticated;

create or replace function public.get_patient_timeline(
  p_patient_id uuid,
  p_cursor_time timestamptz default null,
  p_cursor_kind text default null,
  p_cursor_id uuid default null,
  p_limit integer default 26
)
returns setof public.patient_timeline_events
language plpgsql
stable
security invoker
set search_path = ''
as $timeline$
begin
  if p_patient_id is null then
    raise exception using errcode = '22023', message = 'Patient is required';
  end if;

  if p_cursor_id is null and (p_cursor_time is not null or p_cursor_kind is not null) then
    raise exception using errcode = '22023', message = 'Incomplete timeline cursor';
  end if;

  if p_cursor_id is not null and (
    p_cursor_kind is null or p_cursor_kind not in (
      'appointment_booked',
      'appointment_checked_in',
      'appointment_started',
      'appointment_completed',
      'appointment_cancelled',
      'vitals_recorded',
      'consultation_recorded',
      'laboratory_recorded',
      'prescription_created',
      'prescription_completed',
      'prescription_cancelled'
    )
  ) then
    raise exception using errcode = '22023', message = 'Invalid timeline cursor';
  end if;

  return query
  select page.*
  from (
    values
      ('appointment_booked'::text),
      ('appointment_checked_in'::text),
      ('appointment_started'::text),
      ('appointment_completed'::text),
      ('appointment_cancelled'::text),
      ('vitals_recorded'::text),
      ('consultation_recorded'::text),
      ('laboratory_recorded'::text),
      ('prescription_created'::text),
      ('prescription_completed'::text),
      ('prescription_cancelled'::text)
  ) as kinds(event_kind)
  cross join lateral private.patient_timeline_slice(
    p_patient_id,
    kinds.event_kind,
    p_cursor_time,
    p_cursor_kind,
    p_cursor_id,
    p_limit
  ) page
  order by page.occurred_at desc nulls last, page.event_kind desc, page.source_id desc
  limit least(greatest(coalesce(p_limit, 26), 1), 26);
end;
$timeline$;


