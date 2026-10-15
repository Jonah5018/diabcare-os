# Sprint 18 — SaaS billing and entitlement architecture

Implemented 14 October 2026. Subscription state is distinct from clinic operational suspension and staff capability. The canonical managed subscription table supports trial, active, past_due, suspended and cancelled states. The older `organizations.subscription_status` label is not treated as verified billing and is no longer displayed in Settings.

## Central entitlement policy

`billing_plans` defines Core and Plus capabilities without prices or invented paid accounts. Staff/patient limits are nullable configuration fields for future approved enforcement; no quotas are claimed as enforced. Core enables document uploads; Plus additionally enables communications and expanded reports. Staff capability remains independently required.

Clinics without a managed subscription retain existing access and display Billing not configured. No migration invents a trial, payment or active subscription for the real clinic. Managed optional features require an eligible plan and a future trial end or active billing period. Missing/expired periods and past-due/suspended/cancelled states do not grant optional features. Core clinical recording and reads of existing clinical history/documents remain available when the clinic is operationally active.

The database centralizes policy in `private.clinic_feature_enabled`. Derived current-clinic wrappers and the server entitlement module expose only the caller's configuration. Reports, document reservation/upload policies and notification queue/delivery enforce the same database policy. Role and feature checks are not scattered through unrelated UI components. The Billing page is owner/admin only; it shows real state, enabled features and clear unconfigured/error states, without a fake checkout button.

## Replaceable provider boundary

The normalized event contract is separate from provider parsing and storage. The initial optional Stripe adapter handles single-item subscription created/updated/deleted events, accepts both subscription/item period-end fields and maps actual price IDs using a server-owned configuration. It does not trust provider metadata for organization or plan authorization.

Raw-body signatures are verified before JSON parsing, using HMAC-SHA256, constant-time comparison and a five-minute timestamp tolerance. Bodies are bounded to 64 KiB. Unsupported prices/statuses and invalid signatures are rejected; unsupported event types are ignored without mutation. Signing/header/SDK errors are never logged with raw payloads or secrets. This follows [Stripe's signature verification guidance](https://docs.stripe.com/webhooks/signature).

Only an active platform owner can bind an existing provider customer/subscription to a clinic. Bindings are unique, immutable through this command and audited; they do not grant payment status. Browser roles cannot invoke the trusted billing processor or directly write subscription state.

The backend processor requires the actual `service_role` database role. It resolves the clinic from the controlled account binding, never from browser-submitted organization metadata. The ledger stores event identity, a fingerprint of normalized handled fields and processing outcome, rather than raw payloads. Stable fingerprints tolerate irrelevant JSON ordering/whitespace changes. Event and clinic locks serialize processing; duplicate identical events are idempotent, changed identity/fingerprint is rejected, older events are ignored and conflicting equal-time events require reconciliation. Unknown bindings grant nothing. A verified unmatched event can be retried after account binding through the corrective migration, retaining its original identity/fingerprint.

## Configuration and limits

Billing ingest is disabled by default. Enable only in a controlled environment with server-only `SUPABASE_OPERATIONS_KEY`, `BILLING_WEBHOOK_ENABLED`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_PLANS`, verified account bindings and the supported event set. Never put backend/signing credentials in `NEXT_PUBLIC_` variables. No keys, provider accounts, live webhooks, prices, checkout, charges or customer subscriptions were created by this task.

This is a billing/entitlement foundation, not a complete commercial checkout, tax/invoice engine or provider-state polling reconciler. Real provider delivery/API-version acceptance remains unverified. Equal-time conflicts require current canonical provider state; do not force a browser status or delete ledger history as a shortcut.

## Source and migrations

- `types/billing.ts`, `lib/billing/`: provider contract, normalization, fingerprints and request-local entitlement retrieval.
- `lib/http/body.ts`: bounded raw-body input.
- `lib/supabase/operations.ts`: isolated optional backend client; never used for normal clinical requests or owner-console reads.
- `app/api/billing/webhook/route.ts`, `app/dashboard/billing/page.tsx`: signed ingestion and truthful clinic configuration.
- `scripts/verify-billing.{cjs,sql}`: signature/contract, idempotency, ordering, unmatched replay, role and feature enforcement tests.

Migrations: `20261014123948_provider_billing_events_and_central_entitlements.sql` and `20261014135635_verified_billing_reconciliation_after_account_binding.sql`. Sprint 20 additionally gates active-period expiry and delivery-time eligibility. All synthetic fixtures roll back.
