create index appointments_creator_clinic_fk_idx on public.appointments(created_by, organization_id);
create index appointments_doctor_clinic_fk_idx on public.appointments(doctor_id, organization_id);
create index appointments_patient_clinic_fk_idx on public.appointments(patient_id, organization_id);
create index consultations_doctor_clinic_fk_idx on public.consultations(doctor_id, organization_id);
create index laboratory_recorder_clinic_fk_idx on public.laboratory_results(recorded_by, organization_id);
create index vitals_recorder_clinic_fk_idx on public.vitals(recorded_by, organization_id);
create index vitals_consultation_identity_fk_idx on public.vitals(consultation_id, patient_id, organization_id);
-- Reorder only the history indexes introduced in the preceding migration.
-- Both clinic and patient are equality predicates in the history queries.
drop index public.consultations_patient_history_idx;
create index consultations_patient_history_idx on public.consultations(patient_id, organization_id, visit_date desc nulls last, id desc);
drop index public.laboratory_patient_history_idx;
create index laboratory_patient_history_idx on public.laboratory_results(patient_id, organization_id, created_at desc nulls last, id desc);
drop index public.vitals_patient_history_idx;
create index vitals_patient_history_idx on public.vitals(patient_id, organization_id, created_at desc);
