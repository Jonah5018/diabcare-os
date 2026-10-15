# Sprint 14 — Reports and operational analytics

Implemented 14 October 2026 from the master roadmap. The Reports page now returns 16 fixed operational counts from one database aggregate command, with a default 30-day window and a maximum 31 inclusive Lagos calendar dates. It does not download full patient histories or aggregate them in the browser.

## Definitions

| Measure | Date basis and meaning |
| --- | --- |
| Registrations | Patient creation timestamps inside the window |
| Bookings, non-cancelled, completed, cancelled | Scheduled appointment date; saved current status, rather than completion/cancellation event time |
| Queue volume | Recorded check-in timestamp; includes check-ins later cancelled |
| Consultations | Visit timestamp, falling back to creation timestamp |
| Vitals and laboratory records | Record creation timestamp |
| Prescriptions | Prescribed date, including prescriptions subsequently resolved |
| Follow-up load | Due date in the window; planned status and whether overdue as of today in Lagos |
| Recording cohort | Distinct patients with a non-cancelled booking in the window |
| Recording coverage | Distinct cohort patients with at least one vitals/lab record in the same window |

Unknown legacy timestamps are excluded, rather than invented. Unlinked clinical records can contribute to patient-level coverage. Multiple clinical records or bookings do not inflate distinct patient coverage. Records do not need to belong to the same appointment. Coverage is a recording measure, not an assessment of clinical adequacy, recommended monitoring frequency, treatment effectiveness or patient risk. No-show counts are omitted because no no-show status exists.

## Authorization and performance

`public.get_clinic_operational_report(date, date)` is SECURITY INVOKER with an empty search path. It derives the organization from the active authenticated profile and checks the existing reports role set: platform owner, clinic admin or doctor. It has no submitted organization parameter; all table reads retain RLS and explicit clinic filters. PUBLIC/anonymous execution is revoked. Date limits are independently enforced by SQL and the existing report window validation.

Four indexes support the newly used clinic/check-in, consultation record-time expression, prescribed-date and follow-up due-date predicates. Existing indexes support registrations, scheduled appointments, vitals and laboratories. Counts still scan qualifying rows; bounded windows and indexes are not a million-user throughput proof. Measured load, query plans on realistic data, approved rollups and their refresh architecture belong to capacity work.

## Maintenance map

- `lib/reports/metrics.ts`: validated aggregate DTO and explicit metric labels.
- `lib/reports/queries.ts`: permission-checked server query.
- `components/reports/operational-summary.tsx`: responsive cards and date/coverage definitions.
- `app/dashboard/reports/page.tsx`: filters and invalid-date/query-error states; existing dashboard loading boundary remains.
- `scripts/verify-reports.cjs`: DTO, RPC contract, authorization delegation and component checks.
- `scripts/verify-reports.sql`: tenant/role boundaries, lifecycle counts, distinct coverage, timezone/end bounds and unknown legacy dates. All fixtures roll back.

Applied migration: `20261014110836_bounded_clinic_operational_reports.sql`. Earlier migrations remain unchanged. README, package scripts and CI include `verify:reports`.

## Acceptance limits

Application, database, lint and production compilation checks pass. Live desktop/mobile/multi-role browser acceptance remains unverified under the earlier browser access limitation. No clinical interpretation engine, report export, no-show transition or permanent test clinic was added here.

Proposed commit: `feat: expand bounded clinic operational analytics`.
