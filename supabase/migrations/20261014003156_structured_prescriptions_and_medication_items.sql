-- Structured prescriptions. Existing clinical records and policies are preserved.
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  patient_id uuid not null,
  prescriber_id uuid not null,
  consultation_id uuid not null,
  request_id uuid not null,
  request_fingerprint text not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  prescribed_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, prescriber_id, request_id),
  constraint prescriptions_patient_clinic_fkey
    foreign key (patient_id, organization_id)
    references public.patients(id, organization_id),
  constraint prescriptions_prescriber_clinic_fkey
    foreign key (prescriber_id, organization_id)
    references public.users(id, organization_id),
  constraint prescriptions_consultation_patient_clinic_fkey
    foreign key (consultation_id, patient_id, organization_id)
    references public.consultations(id, patient_id, organization_id)
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  prescription_id uuid not null,
  position smallint not null check (position between 1 and 20),
  medication_name text not null check (length(btrim(medication_name)) between 1 and 200),
  strength text not null check (length(btrim(strength)) between 1 and 100),
  dose text not null check (length(btrim(dose)) between 1 and 100),
  frequency text not null check (length(btrim(frequency)) between 1 and 100),
  route text not null default '' check (length(route) <= 80),
  duration text not null check (length(btrim(duration)) between 1 and 100),
  instructions text not null default '' check (length(instructions) <= 2000),
  created_at timestamptz not null default now(),
  unique (prescription_id, position),
  constraint prescription_items_prescription_clinic_fkey
    foreign key (prescription_id, organization_id)
    references public.prescriptions(id, organization_id)
);

create index prescriptions_patient_history_idx
  on public.prescriptions (patient_id, organization_id, created_at desc, id desc);
create index prescriptions_clinic_history_idx
  on public.prescriptions (organization_id, created_at desc, id desc);
create index prescriptions_prescriber_idx
  on public.prescriptions (prescriber_id, organization_id);
create index prescriptions_consultation_idx
  on public.prescriptions (consultation_id, patient_id, organization_id);
create index prescription_items_parent_idx
  on public.prescription_items (prescription_id, organization_id);

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;

-- Read through RLS. Writes are only through authenticated, atomic commands.
-- No Data API caller can insert a partial header or edit medication items.
revoke all on public.prescriptions, public.prescription_items from public, anon, authenticated;
grant select on public.prescriptions, public.prescription_items to authenticated;

create policy "Active clinic staff can read prescriptions"
on public.prescriptions for select to authenticated
using (organization_id = (select private.current_organization_id()));

create policy "Active clinic staff can read prescription items"
on public.prescription_items for select to authenticated
using (organization_id = (select private.current_organization_id()));

-- A private definer command is required because direct table writes are revoked.
-- It independently verifies identity, activity, capability, clinic and relationships.
create function private.create_clinic_prescription(
  p_patient_id uuid,
  p_consultation_id uuid,
  p_prescribed_date date,
  p_items jsonb,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $command$
declare
  v_actor uuid := auth.uid();
  v_clinic uuid;
  v_id uuid;
  v_existing public.prescriptions%rowtype;
  v_fingerprint text;
  v_item jsonb;
  v_field text;
begin
  select u.organization_id into v_clinic
  from public.users u
  where u.id = v_actor and u.is_active = true
    and u.role in ('doctor', 'organization_admin', 'platform_owner')
  for share;

  if v_actor is null or v_clinic is null then
    raise exception using errcode = '42501', message = 'Prescribing permission required';
  end if;

  if p_request_id is null or p_prescribed_date is null
     or p_prescribed_date < date '1900-01-01'
     or p_prescribed_date > (now() at time zone 'Africa/Lagos')::date then
    raise exception using errcode = '22023', message = 'Invalid prescription date or request';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Medication items must be an array';
  end if;
  if jsonb_array_length(p_items) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Provide 1 to 20 medication items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Invalid medication item';
    end if;
    foreach v_field in array array[
      'medication_name', 'strength', 'dose', 'frequency', 'duration', 'route', 'instructions'
    ] loop
      if jsonb_typeof(v_item -> v_field) is distinct from 'string' then
        raise exception using errcode = '22023', message = 'Medication fields must be text';
      end if;
    end loop;
  end loop;

  if not exists (
    select 1 from public.consultations c
    join public.patients p on p.id = c.patient_id and p.organization_id = c.organization_id
    where c.id = p_consultation_id and c.patient_id = p_patient_id
      and c.organization_id = v_clinic
  ) then
    raise exception using errcode = '42501', message = 'Consultation not available in your clinic';
  end if;

  -- Serialise retries of the same request, without serialising the whole clinic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_clinic::text || ':' || v_actor::text || ':' || p_request_id::text, 0
  ));
  v_fingerprint := md5(jsonb_build_array(
    p_patient_id, p_consultation_id, p_prescribed_date, p_items
  )::text);

  select * into v_existing from public.prescriptions
  where organization_id = v_clinic and prescriber_id = v_actor and request_id = p_request_id;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '22023', message = 'Request already used for another prescription';
    end if;
    return v_existing.id;
  end if;

  insert into public.prescriptions (
    organization_id, patient_id, prescriber_id, consultation_id,
    request_id, request_fingerprint, prescribed_date
  ) values (
    v_clinic, p_patient_id, v_actor, p_consultation_id,
    p_request_id, v_fingerprint, p_prescribed_date
  ) returning id into v_id;

  insert into public.prescription_items (
    organization_id, prescription_id, position, medication_name,
    strength, dose, frequency, route, duration, instructions
  )
  select v_clinic, v_id, ordinal::smallint,
    btrim(item ->> 'medication_name'), btrim(item ->> 'strength'),
    btrim(item ->> 'dose'), btrim(item ->> 'frequency'),
    btrim(item ->> 'route'), btrim(item ->> 'duration'), btrim(item ->> 'instructions')
  from jsonb_array_elements(p_items) with ordinality as medication(item, ordinal);

  return v_id;
end;
$command$;

create function public.create_prescription(
  p_patient_id uuid, p_consultation_id uuid, p_prescribed_date date,
  p_items jsonb, p_request_id uuid
)
returns uuid language sql security invoker set search_path = ''
as $wrapper$
  select private.create_clinic_prescription(
    p_patient_id, p_consultation_id, p_prescribed_date, p_items, p_request_id
  );
$wrapper$;

create function private.transition_clinic_prescription(p_prescription_id uuid, p_status text)
returns uuid language plpgsql security definer set search_path = ''
as $command$
declare
  v_actor uuid := auth.uid();
  v_clinic uuid;
  v_role public.user_role;
  v_record public.prescriptions%rowtype;
begin
  select organization_id, role into v_clinic, v_role
  from public.users where id = v_actor and is_active = true
    and role in ('doctor', 'organization_admin', 'platform_owner')
  for share;
  if v_actor is null or v_clinic is null then
    raise exception using errcode = '42501', message = 'Prescribing permission required';
  end if;
  if p_status is null or p_status not in ('completed', 'cancelled') then
    raise exception using errcode = '22023', message = 'Invalid prescription status';
  end if;

  select * into v_record from public.prescriptions
  where id = p_prescription_id and organization_id = v_clinic for update;
  if not found or (v_role = 'doctor' and v_record.prescriber_id <> v_actor) then
    raise exception using errcode = '42501', message = 'Prescription not available for this action';
  end if;
  if v_record.status = p_status then return v_record.id; end if;
  if v_record.status <> 'active' then
    raise exception using errcode = '22023', message = 'Prescription is already terminal';
  end if;

  update public.prescriptions set status = p_status, updated_at = clock_timestamp()
  where id = v_record.id;
  return v_record.id;
end;
$command$;

create function public.transition_prescription(p_prescription_id uuid, p_status text)
returns uuid language sql security invoker set search_path = ''
as $wrapper$
  select private.transition_clinic_prescription(p_prescription_id, p_status);
$wrapper$;

revoke all on function private.create_clinic_prescription(uuid, uuid, date, jsonb, uuid) from public, anon;
revoke all on function public.create_prescription(uuid, uuid, date, jsonb, uuid) from public, anon;
revoke all on function private.transition_clinic_prescription(uuid, text) from public, anon;
revoke all on function public.transition_prescription(uuid, text) from public, anon;
grant execute on function private.create_clinic_prescription(uuid, uuid, date, jsonb, uuid) to authenticated;
grant execute on function public.create_prescription(uuid, uuid, date, jsonb, uuid) to authenticated;
grant execute on function private.transition_clinic_prescription(uuid, text) to authenticated;
grant execute on function public.transition_prescription(uuid, text) to authenticated;

-- Audit metadata only: no medication names, doses, instructions or fingerprints.
alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type in ('patients', 'appointments', 'consultations', 'vitals',
    'laboratory_results', 'prescriptions', 'prescription_items')
);

create or replace function private.record_clinic_audit_event()
returns trigger language plpgsql security definer set search_path = ''
as $audit$
declare
  row_data jsonb;
  event_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old); else row_data := to_jsonb(new); end if;
  if tg_table_name in ('appointments', 'prescriptions') then
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

create trigger prescriptions_audit after insert or update or delete on public.prescriptions
for each row execute function private.record_clinic_audit_event();
create trigger prescription_items_audit after insert or update or delete on public.prescription_items
for each row execute function private.record_clinic_audit_event();
