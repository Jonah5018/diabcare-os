# Sprint 20 — Observability and incident readiness

Implemented 14 October 2026. The platform has redacted structured events, server-generated correlation IDs, framework error capture, protected database/schema readiness, bounded notification processing and owner-only actionable diagnostics. Logging does not serialize arbitrary errors, URLs, headers, request bodies, identities, clinical content or credentials.

## Logging and health semantics

`lib/observability/events.ts` validates a fixed event/outcome allowlist and strips extra fields at runtime. Records contain timestamp, severity, generated request ID and optional bounded duration/count. Failed clinical writes now use this logger instead of ad hoc console objects. The framework error hook ignores error contents; protected UI faults use the proxy-forwarded server ID where available and generate an independent fallback otherwise. Proxy IDs overwrite submitted IDs and survive cookie refresh/redirects. No patient/actor UUID is intentionally used as a correlation ID.

Authentication rejections are logged as rejected checks, not automatically classified as attacks. Error/log aggregation, retention, anomaly thresholds and external alert routing require deployment configuration. No external alerts were sent, no fake auth-anomaly count is displayed, and no in-memory limiter is presented as distributed protection. Framework/provider log behaviour still needs staging review.

Public `/api/health` reports liveness only and remains independent of database credentials. It returns no-store responses with a fresh request ID. Protected `/api/internal/readiness` requires the operations bearer secret and checks database plus queue/billing schema availability, with a five-second abort deadline. Disabled/unauthorized probes return 404; authorized failures return 503. Successful probes do not prove all clinical workflows, provider delivery or production capacity. Healthy polling/empty worker batches avoid repeated success logs.

## Worker and credential enablement

The optional backend client is isolated in `lib/supabase/operations.ts`, marked server-only and configured without session persistence. Its trusted credential is necessary only for signed billing ingestion and optional backend worker/readiness routes. Ordinary clinical and owner-console data paths keep verified user credentials. It is never returned to a browser or logged.

Defaults in `.env.example` leave endpoints and billing ingest disabled with blank credentials. To enable in staging:

1. Provide the approved server-only backend credential through your secret manager.
2. Generate a long random operations bearer secret and set `OPERATIONS_ENDPOINTS_ENABLED=true`.
3. Configure a hosting scheduler to call `/api/internal/notifications` with that bearer secret. GET supports scheduler invocation; POST is also available. No scheduler was installed or activated here.
4. Verify the protected readiness route using the same authorization, then exercise isolated clinic job processing and lease recovery.
5. Configure and verify billing separately as documented in Sprint 18. Keep production switches disabled until acceptance is complete.

A Vercel scheduler automatically uses its `CRON_SECRET` variable; this application also accepts that value when a dedicated `OPERATIONS_CRON_SECRET` is unset. Keep those values consistent if both are configured. Verify supported scheduling frequency against your hosting plan; no paid resource or deployment was provisioned. See [Vercel cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).

## Actionable diagnostics

`/platform/operations` reads a guarded fixed aggregate snapshot: failed jobs, expired eligible leases, due eligible backlog, oldest backlog age, billing reconciliation and unknown/expired active billing periods. Counts contain no patient records. Configuration indicators are labelled as credentials/switches, not successful integration. Alerts appear only when relevant counts are nonzero or eligible backlog exceeds 15 minutes.

Notification incidents: check scheduler enablement, bearer authorization, backend connectivity and clinic/entitlement eligibility; expired leases recover on the next claim. Inspect delivery-attempt metadata before authorizing any replay of exhausted jobs. Do not claim a patient received a message or reset delivery state blindly.

Billing incidents: check signature secret, supported price mapping and controlled account bindings. Verified unmatched events can retry after binding. Conflicting equal-time states need current canonical provider data; older events must not override newer state. Unknown/expired active periods keep optional entitlements unavailable. Do not change browser payment state or erase the idempotency ledger.

Authentication incidents: group redacted auth rejection events by time/rate and correlate with infrastructure signals. Confirm expired sessions versus abuse before intervention. Rotate compromised backend/bearer/signing credentials through the secret manager, stop the affected processor and verify recovery with isolated accounts. Never paste tokens or clinical payloads into incident tickets.

## Source, verification and limits

- `lib/observability/`, `instrumentation.ts`, `proxy.ts`: safe events and correlation.
- `lib/operations/`: endpoint guards, owner diagnostics and alert rules.
- `app/api/internal/`: protected readiness and worker.
- `app/platform/operations/page.tsx`: error states, truthful metrics and actions.
- `scripts/verify-operations.{cjs,sql}`: redaction, UTF-8/constant-time guards, alert thresholds, disabled endpoints, readiness failures, owner-only diagnostics and hidden lease credentials.

Migration: `20261014133226_operational_diagnostics_and_delivery_security_guards.sql`. It also hardens delivery-time availability, managed billing-period expiry, document command access, metadata restrictions and internal notice audit. Later billing reconciliation is a separate corrective migration.

Application/database/build checks pass. Live schedulers, real provider webhooks, isolated browser journeys, concurrent-session load, external alert routing and restoration remain unverified. Those limits are not represented as green production-readiness or million-user capacity claims. Sprint 21 backup/restore work has not started.
