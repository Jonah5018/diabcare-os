# Sprint 9 — Integrated clinical visit workflow

Implemented after Sprint 8 verification on 14 October 2026.

## Architectural decision

Appointments already identify the scheduled patient visit and own check-in, queue number, and lifecycle. A new encounter entity is not justified at this stage. Optional appointment links provide provenance while keeping vitals, consultations, laboratory records, and prescriptions independent.

Existing records remain unlinked; no historical visit association is guessed. Prescriptions inherit visit identity through their required consultation relationship. Their creation remains atomic and does not modify consultation or appointment state.

## Workflow

Queue **Record vitals** and **Clinical notes** links open the patient folder with validated appointment context. Appointment history also provides a **Review visit workflow** link.

The context banner displays visit date/status, queue number, and database-counted vitals, consultations, laboratory records, and prescriptions associated with that visit. Module links navigate within the patient folder, while status/check-in controls remain on the existing queue page. No new appointment status or clinical permission was introduced.

New vitals, consultations, and labs saved in this context carry appointment_id. Server actions recheck the patient, clinic, visit, and recording status. Users may leave context and record a standalone clinical entry as before. Longitudinal histories continue to show the patient's records, rather than silently becoming visit-only histories.

Waiting and in-consultation visits permit documentation. Completed visits permit late documentation. Scheduled and cancelled visits display history without new visit-linked recording forms. Cancellation retains earlier clinical records. Completion is not gated on the existence of vitals, laboratory results, prescriptions, or consultation notes; missing/failed records cannot corrupt an appointment transition.

Prescriptions follow the selected consultation, including historical consultations. Being in one visit context does not relabel another consultation's prescription.

## Database enforcement

Applied migration: 20261014004308_link_clinical_records_to_appointment_visits.sql.

The migration adds nullable appointment_id to consultations, vitals, and laboratory_results. Composite foreign keys enforce appointment/patient/clinic identity, with restrictive deletion and covering indexes. Existing RLS remains unchanged. Existing privacy-preserving clinical audit triggers still apply.

A private SECURITY INVOKER validation trigger checks the linked appointment under the caller's RLS and rejects scheduled/cancelled linkage. It does not acquire an update-style row lock: laboratory staff have clinical-read access but are intentionally not authorised to update appointments. Lifecycle transitions and clinical documentation remain separate operations; record provenance is enforced by constraints rather than a cross-module transaction. An in-flight clinical save and cancellation may interleave without deleting or invalidating saved history.

## Source map

| Responsibility | Files |
| --- | --- |
| Validated visit lookup and scoped record counts | lib/visits/context.ts |
| Visit banner and module navigation | components/visits/visit-summary.tsx |
| Optional clinical visit validation | lib/validations/clinical.ts; lib/clinical-actions.ts |
| Visit context passed to existing forms | components/vitals/vitals-form.tsx; components/consultations/consultation-form.tsx; components/laboratory/lab-form.tsx |
| Folder integration and cursor preservation | app/dashboard/patients/[id]/page.tsx |
| Queue and history entry links | components/appointments/queue-list.tsx; appointment-history.tsx |
| Application/component verification | scripts/verify-visits.cjs |
| Transactional database verification | scripts/verify-visits.sql |

## Verification and limitations

Application checks cover invalid visit IDs, patient/clinic scope, scheduled/cancelled rejection, late documentation, unlinked compatibility, recording capabilities, and context lookup. The actual visit banner renders with synthetic DTOs and responsive grid classes.

Real database fixtures cover linked clinical records, mismatched patients, laboratory/nurse roles, cancellation retaining history, completed visits allowing late documentation, completion without clinical records, and legacy unlinked entries. All fixtures roll back. Existing appointment/platform/prescription suites also pass.

The final lint/build and database/security results are included in the delivery report. No permanent synthetic records or account reassignment was used. Live desktop/mobile browser interaction remains unverified because of the previously recorded browser-policy and isolated-provisioning limitations.

This sprint does not implement lab ordering, dispensing, automatic completion rules, or the unified paginated timeline planned for Sprint 10. Visit summaries count saved records, not clinical readiness or medical outcomes.

Proposed commit: feat: integrate appointment visit context with clinical records

Pre-commit review on 14 October 2026 expanded tests for count-query clinic/patient/visit filters, cross-clinic linkage, and failed laboratory/prescription saves preserving appointment and consultation history.

The review also found that vitals could explicitly identify a consultation and another appointment for the same patient. Forward migration 20261014011308_enforce_vitals_consultation_visit_consistency.sql adds a composite relationship requiring the consultation and vitals to identify the same visit when both links are supplied. The preflight found zero incompatible records. Nullable legacy links remain valid; no records were modified and neither applied sprint migration was rewritten. A covering index supports the new foreign key.
