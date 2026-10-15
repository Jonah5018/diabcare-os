# Sprint 19 — Platform owner administration

Implemented 14 October 2026. `/platform` is a separate global metadata administration surface. It provides overview counts, a 25+1 keyset organization directory, per-clinic operational/subscription summaries, aggregate staff/patient counts, controlled suspension/restoration and trusted billing account binding. It does not provide global clinical records, impersonation or membership switching.

## Separate identity boundaries

The shared staff identity helper verifies Supabase identity, active profile and a known role. Clinic context additionally requires an assigned operationally active organization. Platform context requires the explicit owner-only capability and can remain available when the owner's clinic is suspended or its clinic assignment is absent. This separation does not relax clinic access requirements or change the current account assignment.

Global RPCs use authenticated owner context with guarded private commands. They expose fixed metadata rather than granting global SELECT on clinical tables. Normal owner clinic pages still filter the assigned clinic and retain RLS. Owners cannot use their normal patient directory to read another clinic's patients; tests verify this distinction. Directory cursors support unknown legacy creation timestamps without inventing dates, and the database fixes the maximum page size.

## Suspension and restoration

Organizations default to active operational status. Only an active owner can change status, with a valid reason code and expected previous state. Conflicting stale changes are rejected and same-desired retries are harmless. The UI requires acknowledgement of the effect and resets controls after refreshed state.

Restrictive RLS policies add active-clinic requirements without widening existing role/ownership policies. BEFORE-write checks also guard clinical writes through existing definer commands. Storage, notification metadata, administrative histories and derived clinic access are restricted when suspended. New staff/invitation writes are protected. Backend notification delivery independently rechecks eligibility after claiming. Already-issued signed document links retain their short bearer-token lifetime; suspension cannot retrospectively revoke them.

Suspension deletes no data, changes no staff role/membership and does not rewrite billing state. Reactivation preserves histories. The separate owner surface allows recovery even after suspending the owner's assigned clinic. No real clinic was suspended by this development task; all mutations in tests use isolated transaction-local organizations and roll back.

## Global audit and support

`platform_audit_events` records owner clinic-status changes and billing binding/subscription updates. It stores actor/target/action/reason/status metadata, without patient content, provider secrets, external customer identifiers or raw payloads. Reads are owner-only and writes are revoked for browser roles. Existing tenant audit behaviour remains separate. Support details expose only aggregate patient/staff counts and binding presence, rather than patient or staff records from another clinic.

## Maintenance map

- `lib/auth/context.ts`: staff identity and stricter clinic context.
- `lib/platform/context.ts`, `queries.ts`: owner context and validated metadata DTOs/cursors.
- `lib/validations/platform.ts`, `actions/platform.ts`: validated, capability-checked status/binding commands.
- `components/platform/clinic-controls.tsx`: acknowledged operations and immutable binding controls.
- `app/platform/`: separate layout, directory/detail/overview and loading/error states.
- `scripts/verify-platform-admin.{cjs,sql}`: identity separation, owner-only access, no global clinical reads, suspension denial, audit, stale changes and recovery.

Migration: `20261014125455_global_platform_metadata_and_clinic_operational_controls.sql`. Sprint 20 adds related operational metadata/storage/delivery safeguards. Previous migrations and existing clinical capabilities were preserved.

Global metrics are database aggregates, not a capacity benchmark. Live desktop/mobile/multi-role acceptance remains deferred under the existing browser access limitation. No impersonation, authority assignment or real account reassignment was performed.
