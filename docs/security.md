# Security review and production controls

Reviewed 15 October 2026. This document separates verified controls, known findings and required provider/staging work. It is not a penetration-test certificate or a claim of regulatory compliance.

## Findings and fixes

1. Original application tables retained anonymous grants and authenticated TRUNCATE/TRIGGER/REFERENCES privileges. RLS does not govern TRUNCATE. Forward migration `20261015053810_revoke_unsafe_browser_table_privileges.sql` revokes all PUBLIC/anon application-table privileges and removes owner-style privileges from authenticated, preserving required authenticated row privileges and existing policies. No truncate/delete or real-record mutation was performed. New catalog assertions fail if these grants return.
2. Appointment lifecycle actions could surface raw database/provider messages and did not validate action identifiers before calls. They now validate UUIDs and return fixed safe feedback for both returned and thrown failures. Stale/terminal state feedback remains intact. Existing tests use valid synthetic UUIDs while retaining lifecycle/tenant assertions.
3. The initial dependency audit reported 38 findings (5 critical, 28 high, 5 moderate). Next.js and eslint-config-next were updated from 16.3.3 to pinned 16.3.8; shadcn from 4.19.0 to pinned 4.21.5, followed by compatible transitive fixes. Package/lockfile changes are deliberate security updates, not an architecture/framework migration. The current audit reports zero critical and nine high findings, all from the unpatched braces dependency chain. No force downgrade or invented override was used to hide them.

The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects versions through 3.0.3 and lists no patched version. Registry latest was 3.0.3 at review. Its fast-glob/micromatch paths include shadcn/registry/ts-morph and the Next ESLint plugin. The application does not pass clinical/request input to those glob tools. Keep build/component-generation tools away from untrusted patterns, restrict CI inputs and track upstream remediation. shadcn remains in the existing dependency classification; full audit findings are not suppressed or hidden by omission. Production deployment requires a reviewed disposition/update for this residual risk. Do not run `npm audit fix --force`, which proposes an unrelated breaking shadcn downgrade.

Reference: the [Next.js ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) is among the patched findings. The application does not add attacker-controlled dynamic ImageResponse rendering. A package audit is a dependency graph signal, not proof that every advisory path is reachable from a clinical request.

## Verified application boundaries

- Identity: server Auth getUser → active public.users → assigned active organization → tenant filters. Browser actor/organization fields are ignored by ordinary clinical actions. No user_metadata authorization or cross-tenant patient cache.
- Authorization: capabilities and SQL checks are separate. Existing clinical roles, doctor ownership, self/owner/last-admin protections and global metadata-only owner context remain. Suspension retains records and blocks clinic access, including related Storage/metadata.
- Recovery: browser PKCE, current-origin callback, two literal destinations, bounded code/flow identifier, no-store/no-referrer response, no raw provider errors, generic reset requests, server/client session validation and matching 12-character minimum passwords. Same-browser verifier dependency and real-email acceptance remain documented in auth-experience.md.
- Sessions/cookies: existing SSR-managed cookie architecture, request-local identity cache, current database profile roles and protected dashboard/platform proxy. Tokens are not rendered into auth pages or persisted by custom code. SDK cookie access is necessary for browser refresh; the application does not claim HttpOnly protects all Supabase browser tokens.
- Server actions: all authorization is server-side; Next.js origin/host action protections remain enabled with no broad allowedOrigins override. Audit export additionally validates same-origin POST and records the request before returning a bounded private CSV.
- RLS/constraints: explicit active-clinic policies and composite tenant/patient/actor/visit foreign keys remain. Current inventory has 60 public foreign keys. Existing policy bypass roles are reserved for provider/admin maintenance, never ordinary browser workflows.
- Privileged SQL: 46 inspected SECURITY DEFINER functions had anonymous execution denied and fixed empty search paths; the provider RLS event trigger uses pg_catalog. Authenticated commands independently authorize current identity; trigger/helper internals revoke staff execution where appropriate. Read-only security SQL checks these properties.
- Storage: private bucket, exact reservation path/owner, upload capability/entitlement, bounded types/size, no overwrite/delete policy and audited short signed URLs. Already-issued URLs remain bearer links until expiry. Byte-level malware scanning/quarantine is not implemented.
- Billing: raw-body signature verification, bounded payload, timestamp tolerance, controlled account binding and idempotent ledger; user metadata/payment claims cannot select organization or entitlement. Disabled until separately configured.
- Operations: disabled by default, bearer-only constant-time protected endpoints, bounded batch/timeouts, separate server-only backend credential. No cookie-authorized worker trigger.
- Input/output: Zod, bounded keysets/date windows/search terms, bound SQL parameters and quoted fixed event-kind choices. React escapes rendered text; no clinical HTML injection surface or raw-error logger was introduced. Fixed CSV whitelist/escaping guards spreadsheet formulas.
- Headers: existing nosniff, frame denial, no-referrer and restrictive browser-feature policy remain; auth and clinical surfaces are non-shared-cache paths. A deployment-tested nonce CSP/HSTS policy is still required as applicable; no brittle unsafe CSP or subdomain-wide preload policy was added speculatively.
- Secrets: backend/signing credentials stay server-only, disabled examples are blank, CLI state/fixtures are ignored, and a Git-candidate high-confidence scanner reports categories/paths without matched secret values.

## Supabase advisor findings

Security: inherited WARN leaked-password protection disabled; two INFO RLS-without-policy notices for private billing tables. Those tables intentionally default deny and revoke browser grants. Do not add permissive policies to silence them.

Performance: 34 INFO unused-index findings after regression execution (35 at initial review); no missing-FK warning or performance warning/error. Read-only pg_stat counters can differ from advisor snapshots. Do not remove safety/history indexes based on a small development dataset.

Remediation: [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [default-deny RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Public Auth settings were read safely: email enabled, signup enabled and email confirmation required. Signup creates an Auth identity only; it grants no clinic profile/membership without controlled invitation acceptance. Password minimum/character rules, session timeouts, MFA, SMTP configuration and leaked-password controls require authorized dashboard verification; they are not inferred from public settings. No settings were changed.

## Distributed abuse controls before production

Supabase Authentication → Rate Limits/Attack Protection: review reset/sign-in/signup limits, configured SMTP recipient restrictions and CAPTCHA/challenge support. Tune with controlled false-positive tests; never expose account existence or disable email confirmation to pass acceptance.

Hosting firewall/WAF: configure distributed route/method-aware limits for public Auth/recovery entry, expensive authenticated writes/exports and webhook requests. The actual Auth API is on Supabase's origin, so an app-host WAF alone does not protect it. Protect both origins. Exemptions must authenticate the real scheduler/provider rather than trust a submitted header/IP blindly. Keep signature, body bounds, idempotency and bearer checks as independent controls.

If an app-level distributed limiter is required, use an approved shared atomic datastore/managed provider with bounded hashed identifiers, retention, quotas, retry-after semantics, outage policy and no clinical content. Paid infrastructure and credential setup require separate approval. No in-memory process map is described as distributed protection; no limiter/provider was provisioned here.

## Required pilot/security acceptance

Use an isolated clinic and controlled invited accounts to test real Auth recovery, cookie refresh/expiry, MFA/provider settings, role changes under concurrency, tenant denial, document transfer/signed-link expiry, webhook replay/order, worker authorization, CSRF failures and logs. Ensure reverse proxies/CDNs do not cache Set-Cookie/user pages or retain recovery query strings. Never perform these checks by weakening RLS or modifying real clinical records.

Run all application suites, read-only security/recovery checks, fourteen transactional database suites, advisors, dependency audit and Git-candidate secret scan. Keep BEGIN/ROLLBACK fixtures intact. No automated test should mutate production credentials or send real patient records to external services.

Recheck the nine high dependency findings and leaked-password setting before release. Source can be reviewed/committed with explicit known-risk disclosure; passing regressions alone is not a production security sign-off.
