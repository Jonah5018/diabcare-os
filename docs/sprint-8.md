# Sprint 8 — Prescriptions and medication management

Implemented and verified on 14 October 2026. Sprint 7 is closed under the user's explicit acceptance of action/regression/database verification; its isolated multi-role browser walkthrough is deferred to supported provisioning and staff invitations.

## Workflow

Save a consultation, then select **Create prescription** from the patient clinical timeline or the clinic Consultations page. The prescription form shows the linked patient and consultation. Enter 1–20 structured medication items: name, strength, dose, frequency, optional route, duration, and optional instructions. No medication or dose is suggested by the application.

Every prescription has a clinic, patient, consultation, authenticated prescriber, prescribed date, status, and timestamps. Consultation linkage is required in this sprint. Existing consultation treatment text is preserved, and older text is not automatically interpreted or migrated into prescriptions.

Patient folders show prescription history with independent 25-row cursor pagination. Each prescription includes its bounded medication items and prescriber display name. Items are shown in their recorded position; only the maximum 20 items within a prescription are sorted in memory.

Active prescriptions may be completed or cancelled. Both are terminal, and medication history remains intact. Completion is a staff-recorded status, not evidence of patient adherence or appointment completion. Medication edits are deliberately unavailable; cancel an incorrect prescription and create a corrected one from the consultation.

## Permissions and database boundary

Creation follows the existing clinical authoring model: doctor, organization_admin, and platform_owner. The authenticated author is recorded as prescriber; there is no browser-selectable actor or clinic. Nurses, receptionists, and laboratory scientists cannot prescribe.

Doctors may transition their own prescriptions. Clinic administrators and platform owners may transition prescriptions within their assigned clinic. Platform owners do not gain global clinical access. Active same-clinic staff can read prescription history, consistent with the existing clinical read model.

Both tables have explicit active-clinic SELECT policies and RLS. Direct INSERT, UPDATE, DELETE, TRUNCATE, and other table privileges are revoked from PUBLIC, anon, and authenticated. Medication items are immutable through the staff Data API.

Public SECURITY INVOKER RPC wrappers delegate to private commands with empty search_path. Private SECURITY DEFINER commands are a deliberate, limited write boundary: they independently verify auth.uid(), active role, clinic, consultation/patient ownership, date, and item structure. This permits one atomic header/items transaction while preventing partial direct writes. They do not weaken existing clinical RLS or use service-role credentials in application requests. Execution is denied to PUBLIC/anon. Privileged migration/maintenance roles remain outside the staff API boundary.

Composite foreign keys enforce patient/clinic, prescriber/clinic, consultation/patient/clinic, and item/prescription/clinic relationships. Restrictive deletion preserves prescription provenance. Indexes cover all new foreign keys and the history access paths.

Creation uses a request UUID with a clinic/prescriber uniqueness constraint and an advisory lock. Repeating the same request returns the original prescription; using its UUID for a changed payload is rejected. An internal payload fingerprint is used only for equality checks and is never displayed or audited. A failed item causes the entire command, including its audit writes, to roll back. Staff-role rows are locked during commands so a concurrent deactivation/role change cannot race the authorisation check.

## Audit

New header/item records are audited prospectively. Header status transitions include current and previous status. Audit events do not include medication names, strengths, doses, frequency, instructions, or request fingerprints. Existing appointment auditing is preserved.

## Source map

| Responsibility | Files |
| --- | --- |
| Structured types | types/prescription.ts |
| Input validation | lib/validations/prescription.ts |
| Capability grants | lib/auth/permissions.ts |
| Authenticated actions and safe errors | actions/prescription.ts |
| Bounded server history query | lib/prescriptions/history.ts |
| Medication fields and creation form | components/prescriptions/medication-fields.tsx; prescription-form.tsx |
| History, transitions, pagination, error state | components/prescriptions/prescription-history.tsx; prescription-module.tsx |
| Consultation prescribing route | app/dashboard/consultations/[id]/prescriptions/new/page.tsx |
| Entry links and folder integration | components/consultations/consultation-list.tsx; app/dashboard/consultations/page.tsx; app/dashboard/patients/[id]/page.tsx |
| Applied database migration | supabase/migrations/20261014003156_structured_prescriptions_and_medication_items.sql |
| Application/rendering regression suite | scripts/verify-prescriptions.cjs |
| Transactional real-database tests | scripts/verify-prescriptions.sql |

## Verification

- Lint and the full production build, including TypeScript, passed.
- Appointment, platform, and prescription suites passed.
- Actual medication form/history components rendered with synthetic DTOs. Checks cover labels, unique input IDs, responsive grid classes, empty history, terminal states, and role/ownership-aware controls.
- Real database fixtures passed before and after applying the migration: atomic rollback, retries, changed retry payload denial, tenant and consultation/patient boundaries, immutable medication items, terminal states, doctor ownership, admin capabilities, receptionist/inactive/anonymous denial, and audit privacy.
- Fixtures rolled back; no permanent synthetic records were added to the current clinic.
- Advisors show no new security/performance warnings. The existing leaked-password-protection warning remains.
- CI now includes verify:prescriptions; this new local CI change has not run remotely.

Live browser creation/completion/cancellation and phone interaction remain deferred: the browser tool rejected the local URL, and supported isolated test-clinic access does not yet exist. Component rendering and database tests are recorded separately and are not described as a live browser walkthrough. No browser-policy bypass, account reassignment, or permanent clinical test records were used.

## Limitations

No medication catalogue, stock/dispensing, printing, interactions checker, autonomous prescribing, renewal automation, or historical text conversion is included. There is no new patient-wide prescribing form independent of a saved consultation. Existing clinic timezone remains Africa/Lagos. Fresh-environment schema baseline and leaked-password protection remain production readiness work.

Proposed commit: feat: add tenant-safe structured prescriptions and medication history

Pre-commit review on 14 October 2026 added safe feedback for thrown RPC transport failures, moved medication-row ID allocation out of React state updaters, and expanded query/permission tests. Live function bodies match the applied migration. No migration was rewritten.
