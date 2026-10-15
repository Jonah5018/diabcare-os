-- Read-only timeline: source RLS and caller privileges remain authoritative.
create view public.patient_timeline_events
with (security_invoker = true)
as
select
  a.organization_id,
  a.patient_id,
  'appointment_booked'::text collate "C" as event_kind,
  a.id as source_id,
  a.created_at as occurred_at,
  a.id as appointment_id,
  jsonb_build_object('scheduled_date', a.appointment_date, 'scheduled_time', a.appointment_time, 'current_status', a.status) as details
from public.appointments a

union all

select
  a.organization_id,
  a.patient_id,
  'appointment_checked_in'::text collate "C" as event_kind,
  a.id as source_id,
  a.checked_in_at as occurred_at,
  a.id as appointment_id,
  jsonb_build_object('queue_number', a.queue_number) as details
from public.appointments a
where a.checked_in_at is not null

union all

select
  a.organization_id,
  a.patient_id,
  'appointment_started'::text collate "C" as event_kind,
  a.id as source_id,
  a.consultation_started_at as occurred_at,
  a.id as appointment_id,
  '{}'::jsonb as details
from public.appointments a
where a.consultation_started_at is not null

union all

select
  a.organization_id,
  a.patient_id,
  'appointment_completed'::text collate "C" as event_kind,
  a.id as source_id,
  a.completed_at as occurred_at,
  a.id as appointment_id,
  '{}'::jsonb as details
from public.appointments a
where a.completed_at is not null

union all

select
  a.organization_id,
  a.patient_id,
  'appointment_cancelled'::text collate "C" as event_kind,
  a.id as source_id,
  a.cancelled_at as occurred_at,
  a.id as appointment_id,
  '{}'::jsonb as details
from public.appointments a
where a.cancelled_at is not null

union all

select
  v.organization_id,
  v.patient_id,
  'vitals_recorded'::text collate "C" as event_kind,
  v.id as source_id,
  v.created_at as occurred_at,
  v.appointment_id as appointment_id,
  jsonb_build_object('systolic_bp', v.systolic_bp, 'diastolic_bp', v.diastolic_bp, 'bmi', v.bmi) as details
from public.vitals v

union all

select
  c.organization_id,
  c.patient_id,
  'consultation_recorded'::text collate "C" as event_kind,
  c.id as source_id,
  coalesce(c.visit_date, c.created_at) as occurred_at,
  c.appointment_id as appointment_id,
  jsonb_build_object('chief_complaint', left(c.chief_complaint, 200), 'diagnosis', left(c.diagnosis, 200)) as details
from public.consultations c

union all

select
  l.organization_id,
  l.patient_id,
  'laboratory_recorded'::text collate "C" as event_kind,
  l.id as source_id,
  l.created_at as occurred_at,
  l.appointment_id as appointment_id,
  jsonb_build_object('hba1c', l.hba1c, 'creatinine', l.creatinine) as details
from public.laboratory_results l

union all

select
  p.organization_id,
  p.patient_id,
  'prescription_created'::text collate "C" as event_kind,
  p.id as source_id,
  p.created_at as occurred_at,
  null::uuid as appointment_id,
  jsonb_build_object('prescribed_date', p.prescribed_date, 'current_status', p.status) as details
from public.prescriptions p

union all

select
  p.organization_id,
  p.patient_id,
  'prescription_completed'::text collate "C" as event_kind,
  p.id as source_id,
  p.updated_at as occurred_at,
  null::uuid as appointment_id,
  '{}'::jsonb as details
from public.prescriptions p
where p.status = 'completed'

union all

select
  p.organization_id,
  p.patient_id,
  'prescription_cancelled'::text collate "C" as event_kind,
  p.id as source_id,
  p.updated_at as occurred_at,
  null::uuid as appointment_id,
  '{}'::jsonb as details
from public.prescriptions p
where p.status = 'cancelled';

revoke all on public.patient_timeline_events from public, anon, authenticated;
grant select on public.patient_timeline_events to authenticated;

-- Keep each event-kind slice bounded before the final chronological merge.
create function public.get_patient_timeline(
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
  cross join lateral (
    select event.*
    from public.patient_timeline_events event
    where event.patient_id = p_patient_id
      and event.organization_id = (select private.current_organization_id())
      and event.event_kind = kinds.event_kind
      and (
        p_cursor_id is null
        or (
          p_cursor_time is not null
          and (
            event.occurred_at < p_cursor_time
            or event.occurred_at is null
            or (
              event.occurred_at = p_cursor_time
              and (event.event_kind, event.source_id)
                < (p_cursor_kind collate "C", p_cursor_id)
            )
          )
        )
        or (
          p_cursor_time is null
          and event.occurred_at is null
          and (event.event_kind, event.source_id)
            < (p_cursor_kind collate "C", p_cursor_id)
        )
      )
    order by event.occurred_at desc nulls last, event.source_id desc
    limit least(greatest(coalesce(p_limit, 26), 1), 26)
  ) page
  order by page.occurred_at desc nulls last, page.event_kind desc, page.source_id desc
  limit least(greatest(coalesce(p_limit, 26), 1), 26);
end;
$timeline$;

revoke all on function public.get_patient_timeline(uuid, timestamptz, text, uuid, integer)
from public, anon;
grant execute on function public.get_patient_timeline(uuid, timestamptz, text, uuid, integer)
to authenticated;

-- Cover timeline ordering without removing the existing clinical indexes.
create index appointments_timeline_created_at_idx
  on public.appointments (patient_id, organization_id, created_at desc nulls last, id desc);

create index appointments_timeline_checked_in_at_idx
  on public.appointments (patient_id, organization_id, checked_in_at desc nulls last, id desc)
  where checked_in_at is not null;

create index appointments_timeline_consultation_started_at_idx
  on public.appointments (patient_id, organization_id, consultation_started_at desc nulls last, id desc)
  where consultation_started_at is not null;

create index appointments_timeline_completed_at_idx
  on public.appointments (patient_id, organization_id, completed_at desc nulls last, id desc)
  where completed_at is not null;

create index appointments_timeline_cancelled_at_idx
  on public.appointments (patient_id, organization_id, cancelled_at desc nulls last, id desc)
  where cancelled_at is not null;

create index consultations_timeline_time_idx
  on public.consultations (
    patient_id, organization_id, (coalesce(visit_date, created_at)) desc nulls last, id desc
  );

create index vitals_timeline_time_idx
  on public.vitals (patient_id, organization_id, created_at desc nulls last, id desc);

create index prescriptions_timeline_status_idx
  on public.prescriptions (patient_id, organization_id, updated_at desc, id desc)
  where status in ('completed', 'cancelled');

