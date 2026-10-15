# Sprint 15 — Audit administration and compliance foundations

Implemented 14 October 2026 from the master roadmap. Audit History supports actor ID, date window, entity, operation and record ID filters. Appointment transitions can be inspected by selecting appointments and a specific appointment record ID. Existing previous/current status, staff role and account activity rendering remains available. Earlier events are not reconstructed or backfilled.

## Read and export architecture

The existing active clinic-admin audit read policy remains in place. UI queries derive organization from verified server context, require `team:view`, apply a default 30-day/max 31-inclusive-day Lagos window and use descending `(created_at, id)` keysets with 25 rows plus one lookahead. Actor/record UUIDs, enum choices and cursors are validated. All filters survive page navigation; selecting an actor or record resets pagination. Errors and empty results are distinguished.

The new `audit:export` capability is explicitly limited to platform owners and clinic administrators. It does not expand other roles' audit access. A same-origin POST Route Handler checks current capability and fetches at most 200 events plus one lookahead. It records an export request before returning a private, non-cacheable CSV attachment; failure to record the request prevents export. GET does not mutate or export audit history. The client can request subsequent export pages with the returned cursor.

CSV fields are explicitly limited to event/time/actor/entity/record/operation IDs and previous/current status, role and activity. Names, contacts, raw JSON details and clinical content are excluded. Values are quoted and escaped, with spreadsheet formula prefixes neutralized. Files remain sensitive administrative material and should be handled accordingly. Pagination describes live records, not a frozen full-history archive: future legal exports need snapshot boundaries, resumable jobs, integrity manifests, controlled artifact storage and restoration verification.

Export auditing stores `stage=requested`, the date window and declared row count. It does not claim successful delivery, download or opening. Direct authorized API/SQL audit reads are not automatically recorded. Unauthenticated requests retain the existing authentication handling; active non-admin roles receive a forbidden export response.

## Retention draft

`audit_retention_settings` holds one clinic-owned draft: optional retention days, proposed legal hold, archive required, editor and update time. Composite editor/clinic ownership, administrator SELECT RLS and revoked direct writes protect it. A guarded command derives actor/clinic and audits draft changes. The period accepts 1–36,500 days or remains undecided; no duration is selected for the current clinic by this implementation.

`deletion_enabled` is permanently false under a database CHECK constraint. The draft can never enable deletion, including when the proposed hold is unchecked. There is no deletion worker, cleanup scheduler, archive promise, legal retention determination or claim of regulatory certification. Before enforcement: establish an approved clinic policy and applicable obligations, define preservation/hold procedures, validate encrypted archives and restoration, and authorize an implementation. No audit or patient data was removed.

## Audit coverage and privacy

Existing database triggers cover patients, appointments, consultations, vitals, laboratory results, prescriptions/items, follow-ups, clinic/staff administration and invitations. These preserve metadata rather than clinical text or measurement content. Sprint 15 adds export request and retention draft events; Sprint 16 adds document metadata and application access requests. Operations are INSERT, UPDATE, DELETE, EXPORT and ACCESS after Sprint 16. Historical enablement dates limit coverage.

Not covered as observed events: every page/read/view, sign-in/session/provider delivery, actual CSV or file download completion, raw Storage API access, infrastructure events or changes outside audited workflows. Retention drafts and request events are foundations, not a comprehensive compliance ledger.

## Maintenance map

- `lib/audit/filters.ts`, `lib/validations/audit.ts`: bounded filter and retention validation.
- `lib/audit/queries.ts`, `types/audit.ts`: tenant-scoped retrieval and shared types.
- `lib/audit/csv.ts`: privacy whitelist and CSV escaping.
- `actions/audit.ts`: guarded retention action.
- `app/dashboard/audit/{page,loading}.tsx`, `export/route.ts`: route orchestration and export endpoint.
- `components/audit/`: filters, events, export controls, retention planning and existing transition details.
- `scripts/verify-audit.{cjs,sql}`: application/HTTP and transactional database verification.

Applied migration: `20261014112016_filtered_audit_export_and_retention_foundations.sql`. Clinic/entity, clinic/actor and clinic/record keyset indexes support filtered retrieval. Earlier applied migration files remain immutable. README, scripts and CI include `verify:audit`.

Tests cover strict filters, scoped fixed limits, CSV privacy/formula handling, origin/role restrictions, next-page export headers, fail-closed audit recording, draft validation, tenant/role isolation and revoked direct writes/deletion. Live browser interaction and frozen legal exports remain unverified/unimplemented respectively.

Proposed commit: `feat: add filtered audit exports and retention planning`.
