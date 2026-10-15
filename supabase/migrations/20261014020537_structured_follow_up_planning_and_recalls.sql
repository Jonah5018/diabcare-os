-- Follow-up planning remains independent of appointments and reminder delivery.
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  patient_id uuid not null,
  consultation_id uuid,
  created_by uuid not null,
  request_id uuid not null,
  request_fingerprint text not null,
  due_date date not null,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (id, organization_id),
  unique (organization_id, created_by, request_id),
  check ((status = 'planned' and resolved_at is null) or (status <> 'planned' and resolved_at is not null)),
  constraint follow_ups_patient_clinic_fkey foreign key (patient_id, organization_id)
    references public.patients(id, organization_id),
  constraint follow_ups_author_clinic_fkey foreign key (created_by, organization_id)
    references public.users(id, organization_id),
  constraint follow_ups_consultation_patient_clinic_fkey foreign key (consultation_id, patient_id, organization_id)
    references public.consultations(id, patient_id, organization_id)
);

create index follow_ups_clinic_due_idx on public.follow_ups (organization_id, status, due_date, id);
create index follow_ups_patient_history_idx on public.follow_ups (patient_id, organization_id, created_at desc nulls last, id desc);
create index follow_ups_author_idx on public.follow_ups (created_by, organization_id);
create index follow_ups_consultation_idx on public.follow_ups (consultation_id, patient_id, organization_id);
create index follow_ups_resolved_time_idx on public.follow_ups (patient_id, organization_id, resolved_at desc nulls last, id desc)
  where resolved_at is not null;

alter table public.follow_ups enable row level security;
revoke all on public.follow_ups from public, anon, authenticated;
grant select on public.follow_ups to authenticated;
create policy "Active clinic staff read follow-up plans"
on public.follow_ups for select to authenticated
using (organization_id = (select private.current_organization_id()));

-- As for prescriptions, direct DML is revoked. Private commands enforce all
-- identity and relationship checks before privileged writes and their audit.
create function private.create_clinic_follow_up(
  p_patient_id uuid, p_consultation_id uuid, p_due_date date, p_reason text, p_request_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare
  v_actor uuid := auth.uid();
  v_clinic uuid;
  v_existing public.follow_ups%rowtype;
  v_fingerprint text;
  v_id uuid;
begin
  select organization_id into v_clinic from public.users
  where id = v_actor and is_active = true
    and role in ('doctor', 'organization_admin', 'platform_owner')
  for share;
  if v_actor is null or v_clinic is null then
    raise exception using errcode = '42501', message = 'Clinical planning permission required';
  end if;
  if p_request_id is null or p_due_date is null
     or p_due_date < (now() at time zone 'Africa/Lagos')::date
     or p_due_date > date '2100-12-31'
     or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'Invalid follow-up plan';
  end if;
  if not exists (select 1 from public.patients where id = p_patient_id and organization_id = v_clinic) then
    raise exception using errcode = '42501', message = 'Patient unavailable in your clinic';
  end if;
  if p_consultation_id is not null and not exists (
    select 1 from public.consultations where id = p_consultation_id
      and patient_id = p_patient_id and organization_id = v_clinic
  ) then
    raise exception using errcode = '42501', message = 'Consultation unavailable for this patient';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_clinic::text || ':' || v_actor::text || ':' || p_request_id::text, 0
  ));
  v_fingerprint := md5(jsonb_build_array(p_patient_id, p_consultation_id, p_due_date, btrim(p_reason))::text);
  select * into v_existing from public.follow_ups
  where organization_id = v_clinic and created_by = v_actor and request_id = p_request_id;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '22023', message = 'Request already used for another plan';
    end if;
    return v_existing.id;
  end if;

  insert into public.follow_ups (
    organization_id, patient_id, consultation_id, created_by,
    request_id, request_fingerprint, due_date, reason
  ) values (v_clinic, p_patient_id, p_consultation_id, v_actor,
    p_request_id, v_fingerprint, p_due_date, btrim(p_reason)) returning id into v_id;
  return v_id;
end;
$command$;

create function public.create_follow_up(
  p_patient_id uuid, p_consultation_id uuid, p_due_date date, p_reason text, p_request_id uuid
)
returns uuid language sql security invoker set search_path = ''
as $wrapper$
  select private.create_clinic_follow_up(p_patient_id, p_consultation_id, p_due_date, p_reason, p_request_id);
$wrapper$;

create function private.transition_clinic_follow_up(p_follow_up_id uuid, p_status text)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare
  v_actor uuid := auth.uid();
  v_clinic uuid;
  v_role public.user_role;
  v_record public.follow_ups%rowtype;
begin
  select organization_id, role into v_clinic, v_role from public.users
  where id = v_actor and is_active = true
    and role in ('doctor', 'organization_admin', 'platform_owner')
  for share;
  if v_actor is null or v_clinic is null then
    raise exception using errcode = '42501', message = 'Clinical planning permission required';
  end if;
  if p_status is null or p_status not in ('completed', 'cancelled') then
    raise exception using errcode = '22023', message = 'Invalid follow-up status';
  end if;
  select * into v_record from public.follow_ups
  where id = p_follow_up_id and organization_id = v_clinic for update;
  if not found or (v_role = 'doctor' and v_record.created_by <> v_actor) then
    raise exception using errcode = '42501', message = 'Plan unavailable for this action';
  end if;
  if v_record.status = p_status then return v_record.id; end if;
  if v_record.status <> 'planned' then
    raise exception using errcode = '22023', message = 'Plan is already terminal';
  end if;
  update public.follow_ups set status = p_status, resolved_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = v_record.id;
  return v_record.id;
end;
$command$;

create function public.transition_follow_up(p_follow_up_id uuid, p_status text)
returns uuid language sql security invoker set search_path = ''
as $wrapper$
  select private.transition_clinic_follow_up(p_follow_up_id, p_status);
$wrapper$;

revoke all on function private.create_clinic_follow_up(uuid, uuid, date, text, uuid) from public, anon;
revoke all on function public.create_follow_up(uuid, uuid, date, text, uuid) from public, anon;
revoke all on function private.transition_clinic_follow_up(uuid, text) from public, anon;
revoke all on function public.transition_follow_up(uuid, text) from public, anon;
grant execute on function private.create_clinic_follow_up(uuid, uuid, date, text, uuid) to authenticated;
grant execute on function public.create_follow_up(uuid, uuid, date, text, uuid) to authenticated;
grant execute on function private.transition_clinic_follow_up(uuid, text) to authenticated;
grant execute on function public.transition_follow_up(uuid, text) to authenticated;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type in ('patients', 'appointments', 'consultations', 'vitals',
    'laboratory_results', 'prescriptions', 'prescription_items', 'follow_ups')
);


create or replace function private.record_clinic_audit_event()
returns trigger language plpgsql security definer set search_path = ''
as $audit$
declare
  row_data jsonb;
  event_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old); else row_data := to_jsonb(new); end if;
  if tg_table_name in ('appointments', 'prescriptions', 'follow_ups') then
    event_details := jsonb_build_object('status', row_data ->> 'status');
    if tg_op = 'UPDATE' then
      event_details := event_details || jsonb_build_object('previous_status', to_jsonb(old) ->> 'status');
    end if;
  end if;
  insert into public.audit_events (organization_id, actor_id, entity_type, record_id, operation, details)
  values ((row_data ->> 'organization_id')::uuid, auth.uid(), tg_table_name,
    (row_data ->> 'id')::uuid, tg_op, event_details);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$audit$;
revoke all on function private.record_clinic_audit_event() from public, anon, authenticated;


create trigger follow_ups_audit after insert or update or delete on public.follow_ups
for each row execute function private.record_clinic_audit_event();

create or replace view public.patient_timeline_events
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
where p.status = 'cancelled'

union all

select f.organization_id, f.patient_id,
  'follow_up_planned'::text collate "C", f.id, f.created_at, null::uuid,
  jsonb_build_object('due_date', f.due_date, 'current_status', f.status)
from public.follow_ups f

union all

select f.organization_id, f.patient_id,
  'follow_up_completed'::text collate "C", f.id, f.resolved_at, null::uuid, '{}'::jsonb
from public.follow_ups f where f.status = 'completed'

union all

select f.organization_id, f.patient_id,
  'follow_up_cancelled'::text collate "C", f.id, f.resolved_at, null::uuid, '{}'::jsonb
from public.follow_ups f where f.status = 'cancelled';


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
      'prescription_cancelled',
      'follow_up_planned',
      'follow_up_completed',
      'follow_up_cancelled'
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
      ('prescription_cancelled'::text),
      ('follow_up_planned'::text),
      ('follow_up_completed'::text),
      ('follow_up_cancelled'::text)
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




