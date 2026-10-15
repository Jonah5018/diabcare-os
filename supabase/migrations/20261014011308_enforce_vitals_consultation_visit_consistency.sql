-- Preserve applied migrations and existing nullable legacy links.
-- When vitals explicitly identify both a consultation and an appointment,
-- they must identify the same patient, clinic and visit as that consultation.
alter table public.consultations
  add constraint consultations_appointment_identity_key
  unique (id, appointment_id, patient_id, organization_id);

alter table public.vitals
  add constraint vitals_consultation_appointment_identity_fkey
  foreign key (consultation_id, appointment_id, patient_id, organization_id)
  references public.consultations(id, appointment_id, patient_id, organization_id);

create index vitals_consultation_appointment_idx
  on public.vitals (consultation_id, appointment_id, patient_id, organization_id);
