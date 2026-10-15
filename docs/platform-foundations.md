# Clinic platform foundations

## Architecture and responsibility

The application remains a modular Next.js monolith backed by Supabase Auth and PostgreSQL. Clinical features stay in their existing actions and components. Sprints 8–20 extend this foundation with prescriptions, visits, timeline, follow-ups, onboarding, protected roles, analytics, audit exports, private documents, durable notifications, billing entitlements, global owner metadata and observability. No additional packages, microservices or production deployment were introduced. External messaging, billing activation and scheduler setup remain disabled/unconfigured until controlled acceptance.

| Responsibility | Location |
| --- | --- |
| Verify identity, active account, organisation, and request-local context | lib/auth/context.ts |
| Application capability matrix and role labels | lib/auth/permissions.ts |
| Database isolation, relationship constraints, and audit protection | supabase/migrations/ |
| Clinical validation and shared safe write path | lib/validations/clinical.ts; lib/clinical-actions.ts |
| Appointment lifecycle and bounded patient/doctor lookups | actions/appointment.ts |
| Cursor validation, ordering, and bounded searches | lib/pagination.ts |
| Bounded report windows and clinic-day boundaries | lib/reporting.ts |
| Server-authenticated dashboard shell | app/dashboard/layout.tsx; components/dashboard/dashboard-shell.tsx |
| Real account details, navigation, and sign-out | components/dashboard/sidebar.tsx; components/dashboard/topbar.tsx; actions/auth.ts |
| Clinic operations pages | app/dashboard/consultations; laboratory; reports; team; audit; settings |
| Loading, error, unavailable-record, and denied-access states | app/dashboard/loading.tsx; app/dashboard/error.tsx; app/error.tsx; app/not-found.tsx; components/shared/access-denied.tsx |
| Security response headers and no-store dashboard responses | next.config.ts; proxy.ts |
| Liveness probe | app/api/health/route.ts |
| Local verification and CI | scripts/verify-*.cjs; scripts/verify-platform.sql; .github/workflows/ci.yml |

React cache in the identity helper deduplicates work within a server render. It must not become a shared cache of users or patients. No service-role key is used in clinical request handling.

## Tenant and role boundary

Every server page obtains the authenticated staff profile. Every clinical write verifies capability, clinic ownership of the patient, and input. The clinic and recorder IDs come from the server; browser-submitted versions are ignored.

RLS independently enforces active-clinic access and clinical write roles. Composite foreign keys keep patients, recorders, doctors, and linked consultations within the same clinic and patient journey. App roles and database roles must be reviewed together when permissions change.

| Capability | Roles |
| --- | --- |
| Register patients | Platform owner, clinic administrator, receptionist, doctor, nurse |
| Book appointments | Platform owner, clinic administrator, receptionist, doctor |
| Advance/cancel appointment workflow | Platform owner, clinic administrator, receptionist, doctor, nurse |
| Save consultations | Platform owner, clinic administrator, doctor |
| Save vitals | Platform owner, clinic administrator, doctor, nurse |
| Save laboratory results | Platform owner, clinic administrator, laboratory scientist |
| Operational reports | Platform owner, clinic administrator, doctor |
| Staff directory and audit history | Platform owner, clinic administrator |

Normal platform-owner clinical access remains scoped to the assigned active clinic. The separate /platform surface deliberately exposes owner-only organization metadata and controls, without global clinical SELECT or impersonation. Staff identity and clinic context are separate so owners can restore a suspended clinic through the global surface; normal clinic context still requires an assigned active organization. See docs/sprint-19.md.

## Query growth controls

- Patient lists, clinic clinical directories, staff, audit events, and patient histories use 25-row keyset pages with one extra row to detect continuation.
- Cursor timestamps and UUIDs are validated before entering filter expressions; malformed cursors restart at the latest page. Clinic filters and RLS apply to every page.
- Patient and doctor booking searches return up to 20 matches. Clinical records resolve their related patient/doctor directly rather than relying on an entire clinic directory in memory.
- Patient search uses an indexed generated search_text column with trigram support. The selected result fields exclude the generated search text.
- Today's queue and future appointments use bounded 25-row offset pages to preserve their existing queue/time ordering. Deep future appointment paging should move to a tested compound cursor if measurements show high volume.
- Queue counters count the entire clinic day, independently of the visible page.
- Reports use aggregate counts within at most 31 days and Lagos timezone boundaries. They do not download clinical records to calculate totals in JavaScript.
- Tenant, history, search, and foreign-key indexes support the implemented access paths. Fresh index usage statistics are not grounds for removing an index in a nearly empty development database.

Exact dashboard/report counts can become expensive at very large tenant sizes. Introduce tenant/date rollups only after measuring the real workload and choosing consistency requirements. Do not cache sensitive records across clinics.

## Audit scope

Database triggers record new patient/clinical records and appointment updates. Clinic administrators can view their clinic's events; staff cannot forge, update, or delete them through the Data API. The private trigger function has an empty search_path and no PUBLIC/anon/authenticated execution grant.

Events store actor, entity type, record identifier, operation, time, and appointment status transitions. They exclude clinical notes and measurement values. Events are recorded prospectively; old records were not backfilled or relabelled.

Audit now includes bounded administrative CSV exports, disabled-deletion retention drafts, document access requests, internal notices and a separate owner-only platform ledger. These record requests/metadata rather than observed delivery or clinical content. Tamper-resistant archival, legal retention enforcement and backup-restoration validation remain future work. See docs/sprint-15.md through docs/sprint-20.md.

## DevOps additions

The GitHub Actions workflow uses pinned official action revisions, read-only repository permission, Node.js 24, npm ci, lint, all fifteen registered application suites and the production build. It is saved locally and has not run on GitHub because changes were not pushed. CI uses clearly labelled public build placeholders rather than production credentials. Fourteen database suites run with transaction/rollback fixtures through a controlled database connection; they are not represented as having run remotely in GitHub Actions.

The app includes a local-only liveness smoke script and a no-store /api/health response. That route deliberately does not claim database readiness. Protected readiness/worker routes, fixed aggregate owner diagnostics and redacted logging are documented in docs/sprint-20.md. The optional server-only operations credential is isolated from ordinary clinical/user data paths. Monitor authenticated synthetic clinic journeys separately in staging.

Geist fonts remain local. The installed Next.js compiler API and worker-thread settings remain enabled so the production build can finish in the restricted Windows environment without disabling type checks.

## What is needed to demonstrate millions of users

“Millions of users” is a population target, not a measured concurrency target. Before a capacity claim:

1. Agree target clinics, staff per clinic, patient records, concurrent staff sessions, appointments per day, retention, and read/write mix.
2. Establish latency and availability objectives and error budgets for login, search, booking, check-in, and clinical writes.
3. Build a separate staging dataset with many synthetic tenants, large tenant outliers, and representative histories. Avoid copying identifiable patient data into load-test environments.
4. Load-test authenticated workflows, simultaneous check-ins, patient search, historical paging, and report windows across independent clinics. Validate isolation during load.
5. Measure application p50/p95/p99, auth round trips, database CPU/IO, connection pressure, slow-query plans, lock waits, queue contention, and storage/index growth.
6. Place compute close to the database, validate connection/pool limits, and size infrastructure against the measured peak and cost envelope.
7. Exercise backup restore and disaster recovery; choose recovery objectives and confirm the provider configuration actually supports them.
8. Add provider-backed abuse/rate controls, monitoring, alerts, and background queues for reminders/exports when those features are implemented. An in-memory limiter in a serverless process is insufficient.
9. Develop controlled clinic provisioning, staff invitations, account recovery, subscription controls, and audited administration before opening self-service onboarding.
10. Gate rollout by staged tenant cohorts and repeat regressions, restore drills, and capacity tests after material changes.

No sharding, partitioning, paid resources, deployment promotion, or broad global cache was added speculatively. The current development dataset does not prove million-user capacity.

## Remaining real account setting

The Supabase security advisor reports that leaked-password protection remains disabled. This is an Auth project setting, not an RLS defect introduced by these changes. Enable and verify it before production, subject to the project's available plan/settings: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Verification and limitations

The full production build and TypeScript checks passed during this pass. Application regressions verify date/cursor validation, role checks, clinic/patient/actor boundaries, and denied writes. SQL fixtures verify the real RLS and queue workflow with synthetic clinics and staff inside a transaction that rolls back.

Database advisors no longer report missing foreign-key indexes. The remaining index notices are informational unused-index statistics on this small dataset. Existing patient and appointment records were preserved, and no persistent synthetic fixtures were retained.

Browser checks verify the implemented foundation pages and responsive layout. On 14 October 2026 the user accepted safe regression/database verification to close Sprint 7. Its isolated multi-role browser walkthrough remains deferred until controlled provisioning and invitations exist, rather than blocking the roadmap. Clinical writes were tested through real database policies and action regressions, without permanent software-test clinical records in the live clinic.

The authenticated mobile browser also verified no-match patient/doctor searches, the indexed patient directory's empty state, and rejection of report windows exceeding 31 days. A whitespace-only consultation was rejected by server validation, displayed feedback, and retained the other entered values without creating a record. Clinical forms reset only after a successful save. Duplicate clinical-note input IDs were corrected.

The local production liveness smoke completed 50 requests at concurrency 5 with zero failures (p50 25 ms, p95 220 ms in this environment). Security headers and the unauthenticated dashboard redirect were checked against the production server. These measurements describe a local health endpoint, not authenticated clinical throughput.
