create or replace function public.check_in_appointment(
  p_appointment_id uuid
)
returns table (
  id uuid,
  queue_number integer,
  status public.appointment_status
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_organization_id uuid;
  v_appointment_date date;
  v_status public.appointment_status;
  v_existing_queue integer;
  v_next_queue integer;

  v_clinic_today date :=
    (
      now()
      at time zone 'Africa/Lagos'
    )::date;

begin
  select
    a.organization_id,
    a.appointment_date,
    a.status,
    a.queue_number
  into
    v_organization_id,
    v_appointment_date,
    v_status,
    v_existing_queue
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception
      'Appointment not found or not accessible';
  end if;

  if v_appointment_date <> v_clinic_today then
    raise exception
      'Only appointments scheduled for today can be checked in';
  end if;

  if v_status =
     'waiting'::public.appointment_status
     and v_existing_queue is not null then

    return query
    select
      a.id,
      a.queue_number,
      a.status
    from public.appointments a
    where a.id = p_appointment_id;

    return;
  end if;

  if v_status <>
     'scheduled'::public.appointment_status then

    raise exception
      'Only scheduled appointments can be checked in';

  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_organization_id::text ||
      ':' ||
      v_appointment_date::text,
      0
    )
  );

  select
    coalesce(max(a.queue_number), 0) + 1
  into
    v_next_queue
  from public.appointments a
  where a.organization_id = v_organization_id
    and a.appointment_date = v_appointment_date
    and a.queue_number is not null;

  update public.appointments a
  set
    queue_number = v_next_queue,
    status = 'waiting'::public.appointment_status
  where a.id = p_appointment_id;

  return query
  select
    a.id,
    a.queue_number,
    a.status
  from public.appointments a
  where a.id = p_appointment_id;
end;
$function$;

revoke execute
on function public.check_in_appointment(uuid)
from public, anon;

grant execute
on function public.check_in_appointment(uuid)
to authenticated;