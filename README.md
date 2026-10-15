# DiabCare OS

A multi-tenant workspace for diabetes clinics and specialist centres, built with the installed Next.js 16, React 19, TypeScript, Tailwind, and Supabase stack.

## Local development

Copy .env.example to .env.local and provide your existing Supabase project's public URL and anon/publishable key. Never put a service-role key in a NEXT_PUBLIC variable.

```powershell
npm ci
npm run dev
```

Sign in at /auth/login. Staff need an active public.users profile with an organisation assigned. Clinical records remain clinic-scoped through server checks and Supabase RLS.

## Checks

```powershell
npm run lint
npm run verify:appointments
npm run verify:platform
npm run verify:prescriptions
npm run verify:visits
npm run verify:timeline
npm run verify:follow-ups
npm run verify:onboarding
npm run verify:staff-roles
npm run verify:reports
npm run verify:audit
npm run verify:documents
npm run verify:notifications
npm run verify:billing
npm run verify:platform-admin
npm run verify:operations
npm run verify:auth
npm run verify:recovery
npm run verify:performance
npm run verify:security
npm run verify:workspace
npm run verify:clinical-review
npm run build
git ls-files --cached --others --exclude-standard | node scripts/scan-secrets.mjs
```

For a local production server:

```powershell
npm run start -- --port 3002
node scripts/load-smoke.mjs http://127.0.0.1:3002/api/health 50 5
```

This smoke test checks liveness only; it does not prove clinical throughput or million-user capacity.

## Implemented pages

Dashboard, patients and clinical folders, bounded clinician review/measurement trends, registration, appointments and queue, consultations, laboratory, reports, clinic team, audit history, notifications, billing configuration, account/clinic settings, and separate platform owner administration/operations.

## Developer guides

- [Platform architecture and scaling](docs/platform-foundations.md)
- [Auth experience and password recovery setup](docs/auth-experience.md)
- [Disaster recovery and bootstrap strategy](docs/disaster-recovery.md)
- [Sprint 21 recovery checkpoint](docs/sprint-21.md)
- [Performance methodology and safe harness](docs/performance.md)
- [Sprint 22 performance checkpoint](docs/sprint-22.md)
- [Security review and production controls](docs/security.md)
- [Sprint 23 security checkpoint](docs/sprint-23.md)
- [Sprint 24 pilot workflows and premium workspace](docs/sprint-24.md)
- [Clinician review definitions, bounds and safety boundary](docs/clinical-review.md)
- [Sprint 25 clinical intelligence foundations](docs/sprint-25.md)
- [Sprint 7 workflow and acceptance](docs/sprint-7.md)
- [Sprint 8 prescriptions and medication history](docs/sprint-8.md)
- [Sprint 9 integrated visit workflow](docs/sprint-9.md)
- [Sprint 10 patient clinical timeline](docs/sprint-10.md)
- [Sprint 11 follow-up planning and recalls](docs/sprint-11.md)
- [Sprint 12 controlled clinic onboarding](docs/sprint-12.md)
- [Sprint 13 role and permission administration](docs/sprint-13.md)
- [Sprint 14 operational analytics](docs/sprint-14.md)
- [Sprint 15 audit exports and retention planning](docs/sprint-15.md)
- [Sprint 16 private patient documents](docs/sprint-16.md)
- [Sprint 17 durable clinic notifications](docs/sprint-17.md)
- [Sprint 18 billing and entitlements](docs/sprint-18.md)
- [Sprint 19 global owner administration](docs/sprint-19.md)
- [Sprint 20 observability and incident runbook](docs/sprint-20.md)
- [Database verification fixture](scripts/verify-platform.sql)

The new migration files match the connected Supabase project's applied versions. Earlier schema creation was performed outside this repository; these files alone do not bootstrap an empty database. Capture a reviewed schema baseline before setting up a fresh environment.

The local working tree is the source of truth. Preserve existing clinical work and do not commit, push, or deploy without the user's instruction.

Security review: Next.js security patches and compatible dependency fixes have been applied. Nine high findings remain in the unpatched braces tooling chain; see docs/security.md. CI displays the full audit and gates critical findings. This is not a production security sign-off.
