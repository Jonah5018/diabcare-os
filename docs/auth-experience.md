# Authentication experience and password recovery

Implemented 15 October 2026 as a focused auth polish. This is not a new roadmap sprint. Existing clinic authorization, tenant boundaries, invitation acceptance and dashboard protection remain in place. No database migration, new dependency, account mutation, Auth setting change, commit, push or deployment was performed.

## Presentation

Login, forgot password, reset password and access unavailable share a reusable presentation shell. Desktop pairs a navy identity panel with a quiet form surface; mobile keeps a compact brand header and prioritizes the form. The care-continuity illustration is decorative, with no invented patient data, activity metrics or certification claims. Existing local fonts and Lucide icons are reused.

The form system provides visible labels, 16px inputs, 44px password controls, clear focus indicators, password-manager autocomplete and live feedback. Password visibility is a real button using Eye/EyeOff, with Show/Hide password labels and pressed state. Loading rotation is limited to `motion-safe`, and no background animation is used.

## Flow

1. Login uses the existing browser Supabase client and `signInWithPassword`. Successful login still navigates to `/dashboard` and refreshes server context. Errors use fixed application copy instead of raw provider messages.
2. Forgot password validates and trims only the email, then calls `resetPasswordForEmail`. Its callback is derived from the current browser origin, not a hardcoded host: `/auth/callback?next=%2Fauth%2Freset-password`. Every submitted valid email gets the same outward conditional response, including provider rejection or transport failure. This deliberately does not certify successful email dispatch. Users are advised to wait, check spam and contact their administrator if delivery fails.
3. Supabase verifies its email link and returns an authorization code to the existing callback route. The installed `@supabase/ssr` browser client already defaults to PKCE and cookie-backed storage. The route uses the existing server client and cookie adapter to exchange the code. The installed SDK's optional `sb_flow_id` is validated and forwarded so concurrent PKCE attempts use their own verifier slot.
4. The callback accepts exactly two literal internal destinations: reset password when `next` exactly matches `/auth/reset-password`; invitation for every other value. External, protocol-relative, nested-query and arbitrary internal destinations cannot become redirect targets. Missing/duplicate/oversized codes, malformed flow identifiers, explicit provider errors and exchange failures return a fixed invalid state without propagating provider detail, authorization codes or tokens.
5. The reset page checks the Auth server with `getUser()`, rejecting missing/anonymous sessions. An invalid callback state cannot fall back to an existing session on that render. No token, code, email or session object is passed into the component. Only a boolean is rendered. Like Supabase's authenticated password-update API, a valid signed-in account may also change its own password from this page; the URL itself is not proof of recovery authority.
6. Submission checks session validity again before `updateUser({ password })`. New passwords require 12–128 characters, cannot be all whitespace and must match confirmation. Passwords are never trimmed or normalized. Twelve characters matches the existing invitation account-creation minimum; any stronger configured provider policy remains authoritative. Fixed weak-password/recovery feedback does not expose raw messages.
7. After an acknowledged update, password inputs are cleared and local sign-out is attempted. The success state links to sign in. If local sign-out fails, the password change remains acknowledged and the UI offers a sign-out retry instead of falsely saying the session ended. This does not promise immediate revocation of every existing access token/device session.

Existing invitation confirmations continue to return to `/auth/invitation`. That page now explains callback failure while preserving the current acceptance component and permissions. Access unavailable preserves its invitation link and existing sign-out action. Neither the proxy nor clinic access guards were changed.

## Supabase Dashboard configuration to verify

Project: `umjstkpzszfzoiqesxob`. These settings were not changed or verified through the timed-out dashboard browser connection.

1. Authentication → URL Configuration: set Site URL to the actual deployment's canonical HTTPS origin. Configure local development separately as appropriate. Do not invent a production domain.
2. Add the trusted callback URLs under Redirect URLs for each intended origin. The invitation flow uses the bare callback; recovery includes the exact `next` query. The installed SDK may append its bounded `sb_flow_id` query. Where dashboard matching requires a wildcard for those query values, use one restricted to the specific origin and callback path, and test matching in staging. Do not use an unrestricted wildcard origin or permit arbitrary sites.

   Local examples:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/callback?next=%2Fauth%2Freset-password`
   - When required for SDK flow IDs, a callback-scoped pattern such as `http://localhost:3000/auth/callback?**`.

   Production equivalents must use your real HTTPS domain. Preserve the already trusted invitation callback.
3. Authentication → Email Templates → Reset Password: verify the reset link uses the Supabase verification flow (normally `{{ .ConfirmationURL }}`) and respects the supplied redirect. Do not replace it with a bare application URL, implicit-flow token fragment or unrelated fixed destination. Test any custom email/redirect template with the PKCE flow.
4. Authentication → Email provider/password settings: confirm email/password authentication, required email confirmation, minimum password length and any configured character/compromised-password rules. The application does not lower provider settings. The inherited leaked-password-protection warning remains outside this UI change.
5. Authentication → Email/SMTP and rate limits: verify permitted recipients, sender/domain, actual reset email delivery and configured throttles. Do not assume default email delivery is production-ready. No recovery email was sent during implementation.
6. Open recovery links in the same browser/profile/origin where the request started; PKCE needs that browser's verifier cookie. Another device/profile, an expired/consumed link or an overwritten/missing verifier can require a fresh request.

Never put backend credentials in browser configuration. These flows use only the existing public Supabase client configuration and user sessions; no service-role client, recovery table or custom reset token store is added. Passwords remain only in form memory/requests to Supabase, never localStorage/sessionStorage, URLs, audit or application logs. Callback responses are private/no-store and no-referrer; auth routes also have explicit no-store headers and noindex metadata. Upstream proxy/hosting request logs must independently redact sensitive auth query strings.

## Maintenance map

| Responsibility | Files relative to repository root |
| --- | --- |
| Shared identity/form layout | `components/auth/auth-shell.tsx`, `auth-shell.module.css` |
| Accessible fields and feedback | `components/auth/password-field.tsx`, `auth-feedback.tsx`, `form-styles.ts` |
| Form interactions | `components/auth/login-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` |
| Validated provider boundaries | `lib/validations/auth.ts`, `lib/auth/browser-flows.ts` |
| Pages and callback | `app/auth/login`, `forgot-password`, `reset-password`, `access`, `callback`, `invitation` |
| Auth metadata and cache headers | `app/auth/layout.tsx`, `next.config.ts` |
| Verification and CI | `scripts/verify-auth.cjs`, updated onboarding callback fixture, `package.json`, `.github/workflows/ci.yml` |

## Verification and remaining manual acceptance

Delivery checks passed: lint, all fifteen existing application verification suites, the additional auth suite, production build/TypeScript and `git diff --check`. The build includes the new recovery pages. Remote CI and live browser/email tests were not run. The React review covered component boundaries, hook cleanup/state, accessible labels/controls, narrow server-to-client props, scoped styling and no unnecessary dependencies.

`npm run verify:auth` exercises input validation, generic recovery results under success/rejection/transport failure, login failures, session rejection, password-update/local-sign-out outcomes, allowlisted callback destinations, flow IDs, failure states and the existing cookie adapter. It renders real form markup and exercises visibility/login handlers with an isolated hook-state harness. Those checks are not a live browser or email walkthrough.

The fifteen existing application suites, lint, production build/TypeScript and `git diff --check` are required for delivery. Current CI now includes the additional auth suite. No SQL schema/policy changes need new database migrations. Database and real email state were not changed to satisfy tests.

Manual acceptance still needs permitted browser access and a designated non-production account/inbox:

- Inspect `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` and `/auth/access` at desktop, tablet and 320/375px mobile widths; check overflow, focus order, zoom and large touch targets.
- Toggle each password independently with mouse/keyboard; verify password managers/autofill and screen-reader labels.
- Check invalid credentials and loading feedback.
- Verify generic forgot-password results for designated existing/non-existing test addresses, without revealing account existence.
- Complete real email → PKCE callback → password update → local sign-out → login with the new password. The user must enter and submit the new credential themselves during browser verification.
- Check expired/reused links, another browser, invalid callback codes and unsafe `next` values.
- Confirm existing invitation email confirmation/acceptance and access-unavailable sign-out.
- Check browser/server/hosting logs without disclosing credentials or callback codes.

Browser verification was blocked by a CDP timeout while selecting the existing Supabase dashboard tab. The earlier localhost policy restriction was not bypassed. No screenshots, actual password changes, mail delivery or live mobile interaction are claimed. Review these pages locally before approval.

Implementation references: [Supabase password recovery](https://supabase.com/docs/guides/auth/passwords), [SSR and PKCE cookie architecture](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [redirect allowlists](https://supabase.com/docs/guides/auth/redirect-urls). Installed SDK source and the installed Next.js route/cookie guides were also inspected; no package upgrade was required.

READY FOR AUTH UI REVIEW
