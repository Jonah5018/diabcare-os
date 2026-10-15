# Sprint 17 — Communication and notification infrastructure

Implemented 14 October 2026. Notification events, delivery attempts, provider execution and confirmed delivery are separate responsibilities. The first working provider is an internal clinic inbox; no patient email, SMS or third-party message is sent by this implementation.

## Durable workflow

Database triggers prospectively enqueue appointment reminders, appointment cancellations and follow-up reminders in the same transaction as their clinical source change. Appointment actions do not call messaging providers. There is no historical backfill. Reminders are due one day before appointments at 09:00 Lagos time, or on the follow-up due date at 09:00. Already-due events become eligible immediately. Workers recheck source status/date; obsolete reminders are suppressed.

Events carry typed source identifiers and revisions, organization/patient relationships and scheduled availability, without clinical notes, measurements or patient contact destinations. Composite foreign keys enforce clinic/patient consistency. A unique source/revision key prevents duplicate publication. An authorized manager can also queue a preset internal notice with an idempotent request UUID; successful notices receive metadata-only audit events.

Claims are bounded to ten rows and use `FOR UPDATE SKIP LOCKED`. A three-minute lease and random token identify each attempt. Active leases are not claimed twice; expired attempts become unknown and receive a new lease. Stale tokens cannot complete work. Failure retries use capped exponential backoff, with a maximum of five attempts. Simultaneous-session throughput is not benchmarked by these sequential fixtures.

The in-app adapter persists inbox insertion and completion atomically. Only that committed operation is returned as delivered. It does not mean patient contact, staff reading or acknowledgement. Transport uncertainty is reported separately and reconciled against durable state. Entitlements and clinic availability are rechecked before delivery, including for backend workers. Ordinary event/attempt table reads exclude lease credentials.

Only the registered `in_app` adapter executes. Transport identifiers and event/attempt schemas permit future adapters, while unsupported providers fail rather than claim delivery. Submitted states are reserved for a future verified asynchronous receipt contract; no external receipt integration is claimed.

## Access and hosting

`notifications:view` is explicit for existing active clinic staff. Managers see bounded event history; other staff see delivered inbox entries. `notifications:manage` is owner/admin only. Manual processing derives the clinic from verified staff context; it cannot process another clinic. Direct authenticated writes are revoked.

The optional protected scheduler route `/api/internal/notifications` supports GET and POST with an operations bearer secret. GET is a deliberate scheduler entry point, protected independently of cookies and unavailable by default. Its backend client and server-only credential can claim eligible jobs across clinics; ordinary clinic and owner-console queries retain their authenticated clients. No scheduler, provider account or credential was provisioned or activated. See Sprint 20 for enablement and incident procedures.

## Source map

- `types/notification.ts`: event kinds/statuses, provider contract and fixed titles.
- `lib/notifications/providers.ts`, `worker.ts`, `queries.ts`: registered transport, bounded processing and scoped history.
- `actions/notification.ts`: capability-checked notice and manual processing actions.
- `components/notifications/`: controls and responsive event list.
- `app/dashboard/notifications/page.tsx`: clinic inbox/history, errors and keyset navigation.
- `scripts/verify-notifications.{cjs,sql}`: application contracts, leases, stale tokens, suspension recheck, RLS and transaction rollback.

Initial migration: `20261014122408_durable_clinic_notifications_and_delivery_attempts.sql`. Later Sprint 18–20 migrations add entitlement checks, availability restrictions, credential-column protection and notice auditing without rewriting the original migration.

External patient messaging requires a selected provider, lawful/approved recipient/contact handling, consent/preferences, verified receipts, idempotent submission/reconciliation, and controlled staging acceptance. Those channels are not enabled. No production throughput or live browser acceptance is claimed.

References: [PostgreSQL locking clauses](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE), [Supabase durable queues](https://supabase.com/docs/guides/queues).
