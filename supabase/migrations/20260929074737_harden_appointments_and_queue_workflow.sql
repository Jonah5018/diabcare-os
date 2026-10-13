-- Appointment lifecycle and audit fields
alter table public.appointments
  alter column status set default 'scheduled'::public.appointment_status,
  alter column status set not null,
  alter column created_by set not null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists checked_in_at timestamptz,
  add column if not exists consultation_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

-- Queue numbers must be positive when present.
alter table public.appointments
  drop constraint if exists appointments_queue_number_positive;

alter table public.appointments
  add constraint appointments_queue_number_positive
  check (
    queue_number is null
    or queue_number > 0
  );

-- Active queue states require a queue number.
alter table public.appointments
  drop constraint if exists appointments_active_queue_requires_number;

alter table public.appointments
  add constraint appointments_active_queue_requires_number
  check (
    status in (
      'scheduled'::public.appointment_status,
      'cancelled'::public.appointment_status
    )
    or queue_number is not null
  );

-- Enforce same-organisation relationships.
alter table public.patients
  drop constraint if exists patients_id_organization_key;

alter table public.patients
  add constraint patients_id_organization_key
  unique (id, organization_id);

alter table public.users
  drop constraint if exists users_id_organization_key;

alter table public.users
  add constraint users_id_organization_key
  unique (id, organization_id);

alter table public.appointments
  drop constraint if exists appointments_patient_organization_fkey,
  drop constraint if exists appointments_doctor_organization_fkey,
  drop constraint if exists appointments_creator_organization_fkey;

alter table public.appointments
  add constraint appointments_patient_organization_fkey
    foreign key (patient_id, organization_id)
    references public.patients (id, organization_id)
    on delete cascade,

  add constraint appointments_doctor_organization_fkey
    foreign key (doctor_id, organization_id)
    references public.users (id, organization_id),

  add constraint appointments_creator_organization_fkey
    foreign key (created_by, organization_id)
    references public.users (id, organization_id);

-- Appointment query indexes.
create unique index if not exists appointments_org_date_queue_unique
  on public.appointments (
    organization_id,
    appointment_date,
    queue_number
  )
  where queue_number is not null;

create index if not exists appointments_org_date_status_idx
  on public.appointments (
    organization_id,
    appointment_date,
    status
  );

create index if not exists appointments_org_doctor_date_idx
  on public.appointments (
    organization_id,
    doctor_id,
    appointment_date
  )
  where doctor_id is not null;

create index if not exists appointments_patient_date_idx
  on public.appointments (
    patient_id,
    appointment_date desc
  );

-- Explicit appointment API privileges.
revoke all privileges
on table public.appointments
from anon;

revoke delete, truncate, references, trigger
on table public.appointments
from authenticated;

grant select, insert, update
on table public.appointments
to authenticated;

-- Replace appointment RLS policies.
drop policy if exists "Clinic insert appointments"
on public.appointments;

drop policy if exists "Clinic update appointments"
on public.appointments;

drop policy if exists "Clinic view appointments"
on public.appointments;

create policy "Clinic staff can view appointments"
on public.appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = appointments.organization_id
      and u.is_active = true
  )
);

create policy "Authorized staff can create appointments"
on public.appointments
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = appointments.organization_id
      and u.is_active = true
      and u.role in (
        'platform_owner'::public.user_role,
        'organization_admin'::public.user_role,
        'receptionist'::public.user_role,
        'doctor'::public.user_role
      )
  )
);

create policy "Authorized staff can update appointments"
on public.appointments
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = appointments.organization_id
      and u.is_active = true
      and u.role in (
        'platform_owner'::public.user_role,
        'organization_admin'::public.user_role,
        'receptionist'::public.user_role,
        'nurse'::public.user_role,
        'doctor'::public.user_role
      )
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = appointments.organization_id
      and u.is_active = true
      and u.role in (
        'platform_owner'::public.user_role,
        'organization_admin'::public.user_role,
        'receptionist'::public.user_role,
        'nurse'::public.user_role,
        'doctor'::public.user_role
      )
  )
);

-- Clean up broad patient policies.
drop policy if exists "Patients can insert own organization"
on public.patients;

drop policy if exists "Patients can update own organization"
on public.patients;

drop policy if exists "Patients can view own organization"
on public.patients;

drop policy if exists "Clinic staff can update patients"
on public.patients;

create policy "Clinic staff can update patients"
on public.patients
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = patients.organization_id
      and u.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = patients.organization_id
      and u.is_active = true
  )
);

-- Organization lookup policy.
drop policy if exists "Organization members can view organization"
on public.organizations;

create policy "Organization members can view organization"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = organizations.id
      and u.is_active = true
  )
);

drop function if exists public.get_user_organization_id();

-- Lock down RLS event helper.
revoke execute
on function public.rls_auto_enable()
from public;

-- Harden hospital-number generator.
create or replace function public.generate_hospital_number()
returns text
language plpgsql
set search_path = ''
as $function$
declare
  next_number bigint;
begin
  next_number :=
    nextval('public.hospital_number_seq'::regclass);

  return
    'MSC-' ||
    lpad(next_number::text, 6, '0');
end;
$function$;

revoke execute
on function public.generate_hospital_number()
from anon;

grant execute
on function public.generate_hospital_number()
to authenticated;

-- Appointment lifecycle guard.
create or replace function public.enforce_appointment_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.organization_id
     is distinct from old.organization_id then
    raise exception
      'Appointment organization cannot be changed';
  end if;

  if new.patient_id
     is distinct from old.patient_id then
    raise exception
      'Appointment patient cannot be changed';
  end if;

  if new.created_by
     is distinct from old.created_by then
    raise exception
      'Appointment creator cannot be changed';
  end if;

  if new.status
     is distinct from old.status then

    if old.status =
       'scheduled'::public.appointment_status
       and new.status not in (
         'waiting'::public.appointment_status,
         'cancelled'::public.appointment_status
       ) then

      raise exception
        'Invalid appointment status transition';

    elsif old.status =
          'waiting'::public.appointment_status
          and new.status not in (
            'in_consultation'::public.appointment_status,
            'cancelled'::public.appointment_status
          ) then

      raise exception
        'Invalid appointment status transition';

    elsif old.status =
          'in_consultation'::public.appointment_status
          and new.status not in (
            'completed'::public.appointment_status,
            'cancelled'::public.appointment_status
          ) then

      raise exception
        'Invalid appointment status transition';

    elsif old.status in (
      'completed'::public.appointment_status,
      'cancelled'::public.appointment_status
    ) then

      raise exception
        'Completed or cancelled appointments are terminal';

    end if;

    if new.status =
       'waiting'::public.appointment_status
       and new.checked_in_at is null then

      new.checked_in_at := now();

    end if;

    if new.status =
       'in_consultation'::public.appointment_status
       and new.consultation_started_at is null then

      new.consultation_started_at := now();

    end if;

    if new.status =
       'completed'::public.appointment_status
       and new.completed_at is null then

      new.completed_at := now();

    end if;

    if new.status =
       'cancelled'::public.appointment_status
       and new.cancelled_at is null then

      new.cancelled_at := now();

    end if;
  end if;

  new.updated_at := now();

  return new;
end;
$function$;

drop trigger if exists appointments_lifecycle_guard
on public.appointments;

create trigger appointments_lifecycle_guard
before update
on public.appointments
for each row
execute function public.enforce_appointment_lifecycle();

-- Initial atomic check-in implementation.
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

  if v_appointment_date <> current_date then
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
from public;

grant execute
on function public.check_in_appointment(uuid)
to authenticated;