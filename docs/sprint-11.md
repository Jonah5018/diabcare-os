# Sprint 11 — Follow-up planning and recalls

Implemented on 14 October 2026 according to the master roadmap. Sprint 12 has not started. Existing uncommitted Sprint 8–10 changes remain preserved.

## Care planning workflow

Staff can create a structured follow-up from the patient folder or a saved consultation. Plans record their patient, responsible organization, optional consultation, author, due date, reason, request identity and lifecycle timestamps. Consultation links are enforced against the same patient and clinic by a composite foreign key. Standalone plans remain valid.

Plans begin as planned and can be resolved as completed or cancelled. A repeat request for the same terminal status is safe; changing a terminal plan to another status is rejected. No staff deletion or direct table editing is exposed. History remains visible after resolution. A replacement plan can be created when the clinical plan changes; in-place rescheduling and reopening are outside this initial workflow.

The new /dashboard/follow-ups page lists upcoming/today plans and overdue plans for recall review. Overdue is computed from due_date and the Lagos clinic date while status remains planned. It is not a new stored status or an automatic clinical decision. Resolved plans remain in the patient folder history. Dashboard previews show the earliest five plans in each list and link to the paginated lists; they are previews, not counts.

## Reminder delivery boundary

Planning does not book an appointment, alter consultation records, resolve an appointment, or send an SMS/email. Appointments and follow-ups remain independently durable. The overdue list supports staff recall review without recording invented contact or delivery events.

The roadmap initially separates scheduling from delivery infrastructure. No provider integration, scheduler, delivery queue, fabricated reminder metric, consent inference or notification control was added. Before delivery is enabled, a separate reviewed implementation must establish patient consent/contact preferences, verified destinations, clinic timezone policy, idempotent delivery jobs, retries, minimal-content templates, opt-out handling and delivery audit. None of those are represented as working in this sprint.

## Permissions and tenant security

| Operation | Roles |
| --- | --- |
| Read same-clinic plans | Existing active clinic staff |
| Create plans | Doctor, organization admin, platform owner |
| Resolve own plans | Doctor |
| Resolve any plan within current clinic | Organization admin, platform owner |
| Direct staff table INSERT/UPDATE/DELETE | None |

New follow-ups:create and follow-ups:update capabilities deliberately mirror the existing clinical authoring model. Appointment booking permissions were not expanded into clinical planning: nurses, receptionists and laboratory scientists can read plans but cannot author or resolve them. No existing capability was changed.

The follow_ups table has explicit RLS, authenticated SELECT only, composite patient/author/consultation clinic foreign keys and query/foreign-key indexes. Browser organization/author IDs are ignored by actions and are not RPC parameters. Private write commands follow the existing prescription pattern: direct table DML is revoked; SECURITY DEFINER commands independently verify auth.uid(), active recognized clinical role, clinic, patient, optional consultation and doctor ownership, with empty search paths. Public wrappers are SECURITY INVOKER. Function execution is explicitly revoked from PUBLIC and anon and granted to authenticated; the command performs the actual authorization check.

Request UUIDs, a normalized payload fingerprint, a scoped advisory transaction lock and a unique constraint make creation retries idempotent. Status changes lock the specific row. Audit trigger records only status/previous-status metadata, with no clinical reason, due-date content or request fingerprint. Existing audit behaviour for other entities is preserved.

## History, timeline and pagination

Patient history uses the existing 25+1 descending created_at/UUID keyset architecture and its own followUpCursor, preserved alongside other histories and visit context. Clinic lists use ascending due_date/UUID cursors to show earliest work first. Both queries are explicitly clinic scoped, bounded and database ordered; no large dataset is sorted in JavaScript. Dashboard previews fetch at most six rows per list and render five.

The security-invoker timeline view now includes follow_up_planned, follow_up_completed and follow_up_cancelled. Planned-event metadata includes the due date and current saved status, without the reason. Terminal milestones use resolved_at. The public timeline RPC recognizes all 14 event kinds and still returns at most 26; its bounded merge now has at most 364 candidates. Existing underlying RLS and invoker slice planning remain in force.

The server helpers return only selected fields needed by the relevant modules, without request fingerprints or organization identity. Form submissions preserve input after failures through the existing explicit transition pattern. Labels, pending feedback, success/error alerts, empty states, loading boundaries, responsive layouts and terminal/ownership control visibility follow current UI conventions. Database permissions enforce the same rules independently of those controls.

## Migration and source map

Applied migration: 20261014020537_structured_follow_up_planning_and_recalls.sql. All 14 local migration versions align with the connected Supabase history. No applied earlier migration was rewritten; no real clinical data was changed.

| Responsibility | Files |
| --- | --- |
| Validated plans and terminal commands | lib/validations/follow-up.ts; actions/follow-up.ts |
| Typed history and due-date cursors | types/follow-up.ts; lib/follow-ups/history.ts; pagination.ts |
| Patient planning, history and status forms | components/follow-ups/follow-up-form.tsx; follow-up-list.tsx; follow-up-module.tsx |
| Dashboard preview | components/follow-ups/follow-up-overview.tsx; app/dashboard/page.tsx |
| Clinic recall/upcoming page | app/dashboard/follow-ups/page.tsx |
| Consultation planning page | app/dashboard/consultations/[id]/follow-ups/new/page.tsx |
| Folder/consultation/navigation integration | Patient profile; consultation list/page; dashboard sidebar |
| Timeline integration | types/timeline.ts; components/timeline/timeline-list.tsx; timeline-module.tsx |
| Application/component verification | scripts/verify-follow-ups.cjs |
| Database regression fixture | scripts/verify-follow-ups.sql |

README, package scripts and CI include verify:follow-ups. The appointment dashboard test isolates the new independent preview component; its existing assertions remain intact, with real preview coverage in the follow-up suite. No dependencies were added.

## Verification and limitations

Lint, all six application suites, build/TypeScript and git diff --check are required for delivery. Five database fixtures cover platform security, prescriptions, visit context, timeline and follow-ups. The new suite checks duplicate-request protection, invalid date/reason rejection, patient/tenant boundaries, direct-write denial, doctor ownership, admin resolution, terminal handling, timeline events, audit privacy, 60 equal-date upcoming plans across keyset pages, correct overdue classification, independent clinical records and inactive/anonymous rejection. All fixtures roll back.

Component tests exercise actual form/list/preview markup, label associations, pending/success/error states, escaped content, responsive layouts and ownership/terminal controls. They do not replace an interactive browser walkthrough. Isolated desktop/mobile multi-role acceptance remains deferred until controlled clinic provisioning/staff invitations and permitted browser access exist. No permanent synthetic records or account reassignment were used.

Reminder delivery is intentionally deferred by the master roadmap. Millions-of-users capacity is not established by these tests; staging throughput/concurrency/deep-page query measurements remain necessary. The original-schema baseline limitation and the existing leaked-password-protection warning remain as recorded in earlier sprint reports.

Proposed commit: feat: add tenant-safe follow-up planning and recall workflows
