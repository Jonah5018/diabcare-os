# Sprint 10 — Longitudinal patient clinical timeline

Implemented on 14 October 2026 according to the master roadmap. Sprint 11 has not started.

## Behaviour

The patient folder now displays one chronological timeline across appointment booking, check-in, consultation start, completion, cancellation, vitals, consultation records, laboratory results and prescription creation/completion/cancellation. Existing recording forms, histories and visit context remain intact.

Booking is an event at the time the appointment was created; its scheduled date is separate metadata. Future appointment dates do not become future clinical events. Lifecycle events require their actual recorded timestamps. Consultation events use visit_date, falling back to created_at only when available. Undated legacy entries remain explicitly undated and sort after dated records. No historical timestamps or visit links are fabricated.

Clinical text is restricted to 200-character chief-complaint and diagnosis previews. Full notes, treatment plans and medication items remain in their existing modules. Measurements keep the units used by the current forms, including creatinine in µmol/L. Status labels explicitly describe current saved status; this is a projection of current records, not an immutable audit log of every edit. Terminal prescription events use updated_at because terminal prescriptions cannot be edited through the supported staff command.

The cards provide module anchors and a validated visit-context link when the source already records an appointment relationship. Prescriptions link to their module; their underlying consultation/visit relationship is preserved without guessing an appointment ID in the timeline projection.

Follow-ups are not yet a structured data source. Their timeline integration belongs with the follow-up entity introduced in Sprint 11. No placeholder follow-up events were added.

## Database and security

public.patient_timeline_events is a read-only UNION ALL view with security_invoker=true. Source-table grants and RLS remain authoritative. No existing policy, capability, foreign key, actor relationship or clinical write API changed.

public.get_patient_timeline is a SECURITY INVOKER function with an empty search path. It filters by patient and the organization derived from the authenticated database identity. Browser-supplied organization or actor IDs are not accepted. Anonymous execution is revoked. The private slice helper is also SECURITY INVOKER, has an empty search path and explicitly revokes public/anonymous execution.

The server helper verifies active clinic context, validates UUIDs and cursors, and validates returned DTOs with Zod. Extra organization/patient columns are stripped before rendering. Failures have an alert state and are never presented as empty history. There is no new shared patient-data cache, write action, materialized snapshot or audit-content duplication.

## Ordering and pagination

Each page renders at most 25 events, fetching one additional event to detect more history. Stable order is occurred_at DESC NULLS LAST, event_kind DESC under the C collation, source_id DESC. The cursor preserves raw PostgreSQL timestamp precision, event kind and UUID, including null timestamps. Invalid cursors show an error rather than silently resetting the history.

The database limits each of the 11 event-kind slices to at most 26 before the final database merge (at most 286 candidates). It returns at most 26 events. The application never downloads an entire history or sorts it in JavaScript. The independent timelineCursor is preserved alongside module cursors and visit context.

Query-plan review found that the initial lateral view query could sort an entire event-kind history before its limit. A forward migration replaces that with a private bound-parameter slice query whose quoted literal event kind allows PostgreSQL to prune the other view branches. A second forward correction matches the existing non-null prescription timestamp index order. The only SQL formatting inputs are a %L-quoted event-kind value and a hardcoded choice of null ordering; patient, identity-derived clinic scope, timestamps, UUIDs and limits stay bound.

Indexes cover the appointment lifecycle timestamps, coalesced consultation time, vitals time and terminal prescription time. Existing laboratory and prescription creation indexes are reused. Plan inspection confirms index eligibility, including a diagnostic consultation Limit -> Index Scan with no intervening sort. Small/empty tables may legitimately use scans or sorts. This is not a production load benchmark; realistic volume, cursor depth, RLS and concurrency still need staging measurements before capacity claims.

## Applied migrations

1. 20261014013457_unified_patient_clinical_timeline.sql
2. 20261014013941_plan_timeline_slices_before_merge.sql
3. 20261014014343_align_prescription_timeline_index_order.sql

All 13 local versions match the connected Supabase migration history. Applied files were preserved; corrections are forward migrations. They add read infrastructure and indexes without rewriting patient records. The repository still needs a reviewed original-schema baseline before it can bootstrap an empty database.

## Source map

| Responsibility | Files |
| --- | --- |
| Event types and labels | types/timeline.ts |
| Precise validated cursors | lib/timeline/cursor.ts |
| Authenticated bounded RPC and minimal DTO | lib/timeline/history.ts |
| Cards, empty/error states and paging | components/timeline/timeline-list.tsx; timeline-module.tsx |
| Folder loading boundary and cursor preservation | app/dashboard/patients/[id]/page.tsx |
| Regression/render verification | scripts/verify-timeline.cjs |
| Rolled-back database verification | scripts/verify-timeline.sql |

CI and README include npm run verify:timeline. No dependencies were added.

## Verification and remaining acceptance

Lint, all five application verification suites, production build/TypeScript and git diff --check pass. The four database suites cover platform/queue/clinical security, prescriptions, visit linking and timeline pagination. Timeline fixtures cover all 11 event kinds, multiple pages of equal microsecond timestamps, null-time entries, no gaps/duplicates, limit clamping, same-patient/clinic scope, receptionist read compatibility, inactive and anonymous denial, and non-writability. Every synthetic fixture rolls back.

Component tests render real timeline components with synthetic DTOs, including escaping, responsive classes, visit links, correct units, empty/error states and independent pagination. They do not constitute an interactive browser test. The isolated desktop/mobile multi-role walkthrough remains deferred until controlled provisioning/invitations and permitted browser access are available; the earlier browser-policy rejection was respected. No permanent synthetic record or account reassignment was used.

Supabase advisors retain the existing leaked-password-protection warning and informational unused-index notices. No new database security warning was found. Authentication policy changes are outside this sprint.

Proposed commit: feat: add tenant-safe paginated patient clinical timeline
