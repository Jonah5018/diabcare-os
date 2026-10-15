-- Cover the patient-first composite foreign key used by document ownership.
create index documents_patient_clinic_fk_idx
  on public.clinical_documents (patient_id, organization_id);
