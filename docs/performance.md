# Performance and load validation

Status: implemented safe Data API/RPC harness and diagnostics; realistic clinic capacity requires staging. No load was run against the current clinic. The protected current project is refused even when execution is requested.

## What is measured

`scripts/load-clinic.mjs` defaults to a plan-only response with zero network requests. Execution requires `--execute`, a reviewed fixture file, an isolated Supabase project, explicit synthetic approval, public publishable/anon key and current tokens for controlled invited staff. Write scenarios additionally require `--include-writes` and an explicit write acknowledgement. Tokens/IDs/rows/error payloads are never printed.

Each token is verified with Auth, then checked against the current active public profile, expected role and exact fixture organization. The target clinic slug must begin `diabcare-load-`, its patient must be clearly Synthetic, and the consultation must belong to that patient/clinic. Backend/secret keys are rejected. No fake Auth users are provisioned by the harness. Use controlled onboarding/invitations in the separate staging project.

The runner records nearest-rank p50/p95/p99, total/per-scenario failures and error rate, elapsed time and bounded concurrency (1–8; 1–1000 logical requests). Failures remain in the timing distribution and error rate; do not hide them. A profile operation comprises bounded parallel reads and is labelled accordingly. These timings include Data API/network/authenticated RLS overhead, not browser rendering or Next.js server-action latency. Validate the latter through permitted browser journeys separately.

## Scenario coverage

| Scenario | Boundary |
| --- | --- |
| Patient search | Indexed synthetic text, clinic filter, maximum 20 |
| Profile | Six patient histories with 26-row limits |
| Timeline | Existing bounded timeline RPC |
| Follow-ups | Existing planned due-date/UUID access path |
| Reports | Existing tenant/role/feature-guarded aggregate RPC |
| Audit | Admin-scoped 26-row history |
| Organization administration | Optional controlled owner, existing bounded global metadata RPC |
| Booking/check-in | Synthetic appointments and real queue RPC, concurrent allocation uniqueness check |
| Vitals/consultation/laboratory | Synthetic role-correct direct Data API writes under existing RLS |
| Prescription | Existing atomic guarded creation RPC with synthetic items and request UUID |

The Data API writes deliberately do not claim to exercise Next.js action validation; existing action regressions cover that layer. The staging clinic must have the intended entitlement state for report/notification cases. The notification lease/retry architecture is inspected and covered by its existing SQL tests; real parallel worker contention remains a separate staging test with external delivery disabled.

## Execution prerequisites

Provide a local, uncommitted JSON fixture with `syntheticOnly: true`, the separate `projectRef`, `organizationId`, `patientId`, `consultationId` and exact `expectedSlug`. Generate those through controlled staging provisioning. Do not copy real clinical rows or identifiers into the example fixture.

Use the approved secret manager/session tooling for these environment variables, not plaintext command arguments:

- `DIABCARE_LOAD_FIXTURE_FILE`: local reviewed fixture path.
- `DIABCARE_LOAD_PUBLIC_KEY`: staging public key.
- `DIABCARE_LOAD_DOCTOR_TOKEN`, `DIABCARE_LOAD_ORGANIZATION_ADMIN_TOKEN`.
- `DIABCARE_LOAD_LAB_SCIENTIST_TOKEN` for writes.
- Optional `DIABCARE_LOAD_PLATFORM_OWNER_TOKEN` for owner metadata.
- `DIABCARE_LOAD_APPROVAL=isolated-synthetic-only`.
- `DIABCARE_LOAD_WRITES=allow-synthetic-writes` only for an approved disposable write run.
- Optional `DIABCARE_LOAD_REQUESTS`, `DIABCARE_LOAD_CONCURRENCY` within the hard bounds.

Run `node scripts/load-clinic.mjs` first. After verifying staging target and authorization, `node scripts/load-clinic.mjs --execute` runs reads; add `--include-writes` only for the disposable fixture clinic. No cleanup command is supplied: preserve diagnostic evidence and use the staging lifecycle/approved teardown after inspection, never broad deletion in the current project.

## Capacity exercise

Agree objectives, role/read-write mix, tenant sizes, peak sessions, cold/warm phases and sustainable request rate before measuring. Build multiple synthetic tenants, a large outlier tenant and histories with equal timestamps/null legacy dates. Run role isolation under load, cursor depth, simultaneous same-day check-ins, terminal transitions and retry conflicts. The first bounded harness is not an unbounded distributed generator; increase infrastructure/load ceilings only after review.

Capture CPU/IO, connection/pool saturation, transaction duration, deadlocks/lock waits, query time, index usage and EXPLAIN plans alongside application samples. Do not log pg_stat_activity query text or patient parameters. Report dataset size, region/runtime, concurrency, duration, successful/failed requests and bottlenecks. Repeat with Next.js/browser traffic before assigning a capacity number.

## Safe current observations

The read-only inventory observed 10 connections, zero waiting locks and zero invalid public indexes at one instant. These are not load peaks. Existing unused-index counts reflect a tiny development dataset and accumulated fixture activity; no index was dropped or added without evidence.

`scripts/verify-performance.sql` runs bounded EXPLAIN ANALYZE SELECTs against an empty all-zero tenant identifier, inside a read-only transaction with a five-second statement timeout. It returns plans/timings/catalog counters, not patient rows. It does not exercise representative tenant data, authenticated RLS or realistic selectivity. Small-table scans/sorts are not evidence of a missing index. Preserve production statistics; no ANALYZE table, VACUUM or statistics reset is issued.

The existing timeline slice indexes, appointment queue uniqueness/locking, trigram patient search, report windows, FK coverage, keysets and bounded platform RPCs were reviewed. Known design limits include exact aggregate counts and appointment offset pagination; only measured staging evidence should trigger rollups/cursor redesign. Current data cannot demonstrate millions of users.

## Verification status

IMPLEMENTED: engine, redacted metrics, scenario adapter, protected-target/membership guards, read-only plan diagnostics and documented methodology.

VERIFIED: synthetic in-process engine/guard tests and current read-only diagnostics; all application/lint/build checks required at the sprint checkpoint.

REQUIRES STAGING: actual authenticated load, distributed sessions, realistic deep pages/large tenants, worker contention, provider settings and browser latency. No p50/p95/p99 clinical capacity results are fabricated for an unexecuted load run.
