# Sprint 13 — Role and permission administration

Implemented on 14 October 2026 according to the master roadmap. Sprint 14 has not started. Previous uncommitted sprint work remains preserved.

## Administration experience

Clinic Team retains staff identity, role and activity, activation/deactivation, invitation issuance/history, expiry and revocation. It now adds a controlled clinic-role form for eligible staff and a readable capability matrix generated from the existing authorization source. Team and invitation histories retain their independent bounded pagination.

Assigning a role changes future access; it does not move clinic membership, reactivate inactive staff, alter clinical authorship or rewrite saved clinical records. Eligible roles are organization_admin, doctor, nurse, receptionist and lab_scientist. No UI or RPC can assign platform_owner. Self and existing platform-owner accounts are protected. An active organization admin cannot be demoted if they are the last active clinic admin.

Pending invitations issued by an organization admin are revoked atomically when that admin loses administration authority. Existing accepted staff memberships are retained. A replacement invitation must be issued by an authorized manager. Activity deactivation continues to make issuer acceptance unavailable under the existing Sprint 12 checks.

The role form includes the role observed when rendered. A changed database role rejects a stale conflicting submission; retrying a change already applied to the same desired role returns success without another update/audit. Successful changes refresh team, audit, settings and workspace routes. Role form keys track the current saved role, preventing old form defaults from persisting after a server refresh.

## Permission model and safeguards

The new team:roles capability is granted only to platform_owner and organization_admin, deliberately following existing team administration. All earlier capabilities remain unchanged. The matrix is informational and derives its cells from can(), rather than maintaining a second grant map. It explains that underlying RLS, clinical ownership and protected-account rules also constrain operations.

The server action verifies active clinic context and capability, validates staff UUID/new role/expected role with Zod, rejects self changes and sends only those three fields to the RPC. Submitted actor or organization fields are ignored. Database checks independently enforce authorization, so hiding a control is not a security boundary.

public.change_staff_role is an invoker wrapper around private.change_clinic_staff_role. The private command has an empty search path, explicitly verifies the actor's active management role before target lookup and reuses the clinic membership lock/authority recheck from Sprint 12. It locks the target profile, validates tenant scope, protected accounts, current expected role and the last active administrator before updating only role.

Clinic administrators can change staff in their own clinic. Platform owners retain the already-established global administration authority through the guarded database command; the Clinic Team UI remains scoped to their current clinic. Neither role can assign platform_owner or change existing owner accounts through this workflow. PUBLIC and anonymous function execution is revoked; direct public.users DML remains revoked. No RLS policy, tenant relationship or clinical capability was weakened.

The clinic advisory lock is shared with activity changes and invitation acceptance, so the last-admin check and membership mutation serialize with those operations. The tests verify sequential protections and stale-role conflicts; true concurrent-session contention and load measurements still require staging. No concurrency benchmark is claimed.

## Audit

The administrative audit trigger now records previous/current role and activity, plus previous/current invitation status. Details contain no email, contact/profile content, invitation secret/hash or clinical text. Audit History renders those before/after fields through a separate small component while retaining older appointment/prescription/follow-up status rendering. The existing active clinic-admin audit read policy remains in force.

Database tests demonstrate fresh permissions after role changes: a doctor changed to nurse cannot insert consultations but can record vitals, and an admin changed to doctor cannot invoke staff role commands. Role checks use current database profile data rather than editable user metadata or stale JWT role claims. Already saved records remain linked to their original author and clinic.

## Source map

| Responsibility | Files |
| --- | --- |
| Role validation | lib/validations/staff-role.ts |
| Authorized role action and safe failures | actions/staff-role.ts |
| Clinic-role selector | components/onboarding/staff-role-form.tsx |
| Team integration and activity preservation | components/onboarding/staff-activity.tsx; app/dashboard/team/page.tsx |
| Canonical capability labels and display | lib/auth/permissions.ts; components/onboarding/permission-matrix.tsx |
| Before/after audit rendering | components/audit/audit-details.tsx; app/dashboard/audit/page.tsx |
| Application/component verification | scripts/verify-staff-roles.cjs |
| Rolled-back database fixture | scripts/verify-staff-roles.sql |

Applied migration: 20261014101028_controlled_clinic_staff_role_administration.sql. All 17 local migration versions align with the connected Supabase history. No prior applied migration was rewritten. No new table, dependency, clinical entity or sensitive shared cache was introduced. The repository still needs its reviewed original-schema baseline before bootstrapping an empty database.

README, package scripts and CI include verify:staff-roles. The existing onboarding suite isolates the new role-form component while retaining its original activity assertions; the new suite renders the real role form, matrix and audit component.

## Verification and limitations

Lint, eight application suites, build/TypeScript and git diff --check pass. Seven transactional database fixtures cover platform security, prescriptions, visits, timeline, follow-ups, onboarding and staff roles. New tests cover management capabilities, same/foreign clinic targets, self/owner protections, last-admin demotion, expected-role conflicts, idempotent retries, current clinical permissions, retained clinical authorship/activity, revoked delegated invitations, audit privacy, direct-write denial and inactive/anonymous denial. All fixtures roll back.

Component tests cover role option limits, unique label associations, ownership/capability visibility, responsive staff cards and matrix scrolling, and before/after audit details without unrecognized content. Shared ActionForm supplies pending/error/success handling and preserves inputs on errors. Those tests do not replace live desktop/mobile/multi-role interaction.

Live isolated browser and real email-delivery walkthroughs remain deferred until designated controlled test inboxes and permitted browser access are available. No real staff role, account assignment, patient record or permanent synthetic fixture was changed. The previous browser URL-policy rejection was respected.

The inherited leaked-password-protection warning remains documented. Production capacity and cross-session concurrency are not established by these regression checks. Configurable custom roles/grants, global authority management and membership switching remain outside this sprint.

Proposed commit: feat: add protected clinic staff role administration
