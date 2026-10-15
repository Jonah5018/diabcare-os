# Sprint 12 — Clinic onboarding and staff invitations

Implemented on 14 October 2026 according to the master roadmap. Sprint 13 has not started. Existing uncommitted Sprint 8–11 work is preserved.

## Supported workflows

Platform owners open Clinic Onboarding to create a named clinic with a unique slug and an initial organization-admin invitation. Clinic creation and invitation issuance are one transaction. The current owner account remains assigned to its original clinic. The new clinic does not gain an administrator until the named verified recipient accepts. No new global clinical read permission or tenant-switching mechanism is added.

Clinic administrators invite staff from Clinic Team into their own clinic. Platform owners can manage invitation summaries for a selected clinic through the platform onboarding pages. Roles are organization admin, doctor, nurse, receptionist and laboratory scientist; platform-owner invitations are forbidden. Existing staff roles cannot be changed by issuing an invitation.

Staff activation/deactivation is available in Clinic Team. Self and platform-owner accounts are protected. The last active organization admin cannot be deactivated. Clinic membership commands serialize within their clinic before rechecking authority; acceptance additionally serializes by Auth user identity, preventing simultaneous cross-clinic acceptance from assigning two memberships.

Settings now provides bounded clinic name/email/phone/address editing for authorized administrators. Slug and subscription are preserved. Arbitrary users cannot create clinics, alter roles or choose their membership.

## Invitation security

Invitation secrets contain 32 cryptographically random bytes from PostgreSQL pgcrypto. Only a SHA-256 digest is stored, with a unique token-hash index. Authenticated table grants expose selected summary columns, never token_hash. Invitations expire after seven days. Replacement issuance revokes the previous pending invitation for the same clinic/email. Pending invitations can be revoked; accepted invitations cannot be revoked into another state.

The raw secret is returned only on issuance to the authorized administrator. The administration form provides a private link to share manually. It is not sent through email/SMS by the application. Auth confirmation messages are distinct from staff invitation delivery and are sent only when a recipient explicitly creates an Auth account through the UI.

Private links use /auth/invitation#token=... so the secret is absent from HTTP request URLs. The acceptance component loads it into an uncontrolled password input and removes the fragment from browser history. It is never stored in local storage. Existing no-referrer headers apply. Do not put invitation links in public logs, tickets, screenshots or analytics.

Acceptance requires an authenticated non-anonymous Auth user whose email_confirmed_at is populated and whose normalized Auth email matches the invitation. Role, name and clinic come exclusively from the invitation record. Existing public.users profiles, including inactive or unassigned legacy profiles, are never reassigned. Accepted-token retries are idempotent for the same Auth identity and do not reactivate or alter a profile. The issuer must still hold active clinic-management authority when a pending invitation is accepted.

The connected project's public Auth settings were checked: email authentication enabled, signup enabled, mailer_autoconfirm=false (confirmation required). Keep confirmation required. No Auth configuration, provider key or email template was changed.

Recipients may sign in to an existing Auth-only account or create an Auth account with their invited email. New account passwords need at least 12 characters in this UI, with provider validation also authoritative. The PKCE callback exchanges the confirmation code and uses a fixed /auth/invitation destination, ignoring external next URLs. If confirmation opens a separate page, the recipient reopens the original private link. The verified-email requirement remains enforced by the database.

Configure exact trusted /auth/callback URLs for local/staging/production origins in Supabase Auth's redirect allowlist before live email walkthroughs. Verify Site URL, confirmation delivery, SMTP/rate limits and provider templates in staging. No broad redirect wildcard or service-role key is required by this implementation.

## Database and authorization

staff_invitations has explicit RLS, clinic/admin summary reads, foreign keys, expiry/state constraints, a unique pending clinic/email index and indexes covering history, issuer and acceptor relationships. Public users/organizations direct DML is revoked; existing read RLS remains unchanged.

Public command wrappers are SECURITY INVOKER. Private write commands are SECURITY DEFINER because direct table writes are revoked; they independently verify auth.uid(), active role, clinic scope, protected accounts and relationships with empty search paths. PUBLIC and anon execution is explicitly revoked. Authenticated callers receive no unchecked privileged operation. Provisioning/listing all clinics is platform-owner-only; it grants no cross-clinic patient access. Regular admin actions derive their current clinic server-side. Only platform-owner invitation targeting accepts a selected clinic ID, which is independently authorized by the database.

Administrative audits record operation and minimum status/role/activity metadata, with no invitation secret/hash, email or contact/profile content. Existing clinical audit behaviour is preserved.

The forward privacy correction scopes issuance's existing-profile check to the target clinic. Clinic admins cannot use invitation issuance to discover membership in another clinic. Acceptance still rejects any existing profile globally, so an invitation cannot move a member or change their role.

## Pagination and source map

Team records and invitation history have independent 25+1 keyset cursors. Platform clinic listing is UUID-keyset paginated with a fixed 26-row maximum. Invitation summaries omit secrets and are capped at 26. No large client-side history filtering/sorting, new dependency, provider integration or shared sensitive cache was introduced.

| Responsibility | Files |
| --- | --- |
| Controlled clinic actions | actions/clinic.ts |
| Invitation/staff activity commands | actions/staff.ts |
| Authenticated acceptance | actions/invitation.ts |
| Shared administration guard/RPC handling | lib/onboarding/commands.ts |
| Validation and DTOs | lib/validations/onboarding.ts; types/onboarding.ts |
| Platform onboarding pages | app/dashboard/clinics/page.tsx; [id]/page.tsx |
| Invitation acceptance and confirmation | app/auth/invitation/page.tsx; callback/route.ts |
| Administration UI | components/onboarding/*.tsx |
| Team/settings/navigation entry points | Existing team/settings/access pages and sidebar |
| Application/component verification | scripts/verify-onboarding.cjs |
| Rolled-back database fixtures | scripts/verify-onboarding.sql |

## Applied migrations

1. 20261014091224_controlled_clinic_onboarding_and_staff_invitations.sql
2. 20261014091450_scope_invitation_membership_checks_to_clinic.sql

All 16 local versions match the connected Supabase history. Applied migrations were preserved; the privacy correction is forward-only. Existing clinical data and the current owner membership were not modified. A reviewed original-schema baseline is still needed to bootstrap an empty database.

## Verification and remaining acceptance

Lint, seven application suites, build/TypeScript and git diff --check pass. Six transactional SQL suites verify platform security, prescriptions, visits, timeline, follow-ups and onboarding. Onboarding fixtures verify initial admin provisioning, stored-role acceptance, email verification/matching, idempotent retries, expiry/revocation/replacement, no self-assigned or platform role escalation, cross-clinic denial, unchanged existing membership, protected self/owner/last-admin accounts, activation/deactivation, anonymous denial, token-hash read denial and audit privacy. All synthetic data rolls back.

Component checks cover protected staff controls, unique invitation input labels, role options and callback redirect safety. Prior clinical suites remain intact. No permanent test clinic/account, invitation email, real patient record modification or account reassignment was used.

Controlled provisioning/invitation code now exists; the earlier architectural prerequisite for isolated clinical acceptance is addressed. Live desktop/mobile/multi-role and real email-delivery walkthroughs remain unverified because permitted browser access and designated controlled verification inboxes are still needed. Do not treat database fixtures as those browser tests. The previous browser URL-policy rejection was respected.

The inherited leaked-password-protection warning remains documented; authentication policy settings were not changed. Production capacity and concurrency require staging measurements. General existing-role change administration belongs to Sprint 13; SaaS self-service signup/provisioning, membership switching and automatic invitation delivery are not enabled.

Proposed commit: feat: add controlled clinic onboarding and secure staff invitations
