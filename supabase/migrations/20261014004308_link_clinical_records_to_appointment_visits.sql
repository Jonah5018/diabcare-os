-- An appointment already represents a scheduled visit. Keep clinical records
-- separate and add optional provenance rather than introducing another entity.
alter table public.appointments
  add constraint appointments_patient_visit_identity_key
  unique (id, patient_id, organization_id);

alter table public.consultations add column appointment_id uuid;
alter table public.vitals add column appointment_id uuid;
alter table public.laboratory_results add column appointment_id uuid;

alter table public.consultations
  add constraint consultations_appointment_patient_clinic_fkey
  foreign key (appointment_id, patient_id, organization_id)
  references public.appointments(id, patient_id, organization_id);
alter table public.vitals
  add constraint vitals_appointment_patient_clinic_fkey
  foreign key (appointment_id, patient_id, organization_id)
  references public.appointments(id, patient_id, organization_id);
alter table public.laboratory_results
  add constraint laboratory_appointment_patient_clinic_fkey
  foreign key (appointment_id, patient_id, organization_id)
  references public.appointments(id, patient_id, organization_id);

create index consultations_appointment_idx
  on public.consultations (appointment_id, patient_id, organization_id);
create index vitals_appointment_idx
  on public.vitals (appointment_id, patient_id, organization_id);
create index laboratory_appointment_idx
  on public.laboratory_results (appointment_id, patient_id, organization_id);

create function private.validate_clinical_appointment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $visit$
declare
  v_status public.appointment_status;
begin
  if new.appointment_id is null then return new; end if;

  select a.status into v_status
  from public.appointments a
  where a.id = new.appointment_id and a.patient_id = new.patient_id
    and a.organization_id = new.organization_id;

  if not found then
    raise exception using errcode = '42501', message = 'Visit not available for this patient and clinic';
  end if;
  if v_status not in ('waiting', 'in_consultation', 'completed') then
    raise exception using errcode = '22023', message = 'Check in the visit before linking clinical records';
  end if;

  -- Completed visits allow late documentation. Never require records in order
  -- to complete an appointment or undo records when a visit is cancelled.
  return new;
end;
$visit$;
revoke all on function private.validate_clinical_appointment() from public, anon, authenticated;

create trigger consultations_validate_visit before insert or update on public.consultations
for each row execute function private.validate_clinical_appointment();
create trigger vitals_validate_visit before insert or update on public.vitals
for each row execute function private.validate_clinical_appointment();
create trigger laboratory_validate_visit before insert or update on public.laboratory_results
for each row execute function private.validate_clinical_appointment();
