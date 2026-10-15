# Sprint 24 — Pilot clinic readiness and premium UX

IMPLEMENTED: coherent navy/slate/cyan workspace shell, grouped permission-filtered navigation, quieter cards/status badges, clearer page hierarchy, real operational dashboard counts, role-specific workflow actions, improved directory search/mobile cards, patient-folder section navigation, form feedback, pagination, reduced-motion loading and safe error/access states. Platform administration shares the visual treatment while retaining its separate guard and metadata-only scope.

The shared shell/headers/surfaces apply to Dashboard, Patients/Profile, Appointments/Queue, Follow-ups, Consultations, Laboratory, Reports, Team, Audit, Documents, Notifications, Billing, Settings and Clinic Onboarding. Existing clinical module actions/histories remain. No fake statistics, role expansion, patient mutations or dependency additions were used for this UX work.

## Dashboard data

The fixed organization count was replaced by useful active-clinic measures: registered patients, today's non-cancelled appointments, today's waiting appointments and planned follow-ups due before today. Counts are database aggregates with explicit organization filters and Lagos date rules. Failed/missing counts fail visibly rather than displaying fabricated zeroes. Follow-up previews remain bounded and are not labelled as complete counts. There is no fake activity stream, growth percentage or health/uptime indicator.

## Role workflow review

| Role | Starting workflow | Administrative restrictions |
| --- | --- | --- |
| Receptionist | Registration, arrivals/queue, patient folders | No reports, staff roles, audit exports, billing or prescribing |
| Nurse | Select patient for vitals, review queue, patient history | No consultation/prescription authoring or administration |
| Doctor | Consultation records, follow-up review, patient folders/reports | No team/billing/platform management |
| Laboratory scientist | Laboratory history and selected patient results | No prescribing, consultation authoring or team management |
| Clinic admin | Queue, staff/invitations and operational reports | Current clinic only; no platform owner assignment |
| Platform owner | Assigned clinic workflow plus separate global metadata navigation | No global clinical browsing or impersonation |

All roles keep the existing shared clinical-read navigation; only restricted administrative links use capability filtering. Quick actions guide permitted tasks rather than broadening authority. The canonical capability matrix and database checks remain authoritative.

## Accessibility and interaction

Minimum 44px controls and 16px clinical inputs are scoped to `.clinic-workspace`, leaving the auth design independent. Links/buttons have visible keyboard focus. The mobile drawer retains Escape, focus trapping, background inertness, scroll locking and focus restoration, with explicit trigger controls/expanded state. Patient directory tables retain scoped headings and mobile cards. Statuses include text, not color alone. Loading animation is motion-safe and decorative translation/bounce was removed.

## Verification and pilot acceptance

VERIFIED: application tests cover role navigation/action visibility, real dashboard filters, unavailable-count handling, responsive markup, escaping, explicit badge labels, menu ARIA, safe errors and reduced-motion loading. Existing clinical/authorization suites, lint and build are run before Sprint25. No schema change needs a migration.

REQUIRES STAGING / BROWSER: inspect desktop/tablet/320–375px mobile layouts, focus/zoom/overflow, drawer open/close/resize, form errors/retry and real five-role clinical journeys. Previous browser policy/connection limitations were respected; no live visual/screenshots or role sessions are claimed. Review each listed page with controlled synthetic clinic data, keeping external messaging/billing disabled. Record actual observations and defects before pilot approval.

Known production gates remain in security.md, performance.md and disaster-recovery.md. Premium presentation does not establish security certification, clinical quality or measured production capacity.
