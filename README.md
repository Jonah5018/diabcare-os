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
npm run build
```

For a local production server:

```powershell
npm run start -- --port 3002
node scripts/load-smoke.mjs http://127.0.0.1:3002/api/health 50 5
```

This smoke test checks liveness only; it does not prove clinical throughput or million-user capacity.

## Implemented pages

Dashboard, patients and clinical folders, registration, appointments and queue, consultations, laboratory, reports, clinic team, audit history, and account/clinic settings.

## Developer guides

- [Platform architecture and scaling](docs/platform-foundations.md)
- [Sprint 7 workflow and acceptance](docs/sprint-7.md)
- [Database verification fixture](scripts/verify-platform.sql)

The new migration files match the connected Supabase project's applied versions. Earlier schema creation was performed outside this repository; these files alone do not bootstrap an empty database. Capture a reviewed schema baseline before setting up a fresh environment.

The local working tree is the source of truth. Preserve existing clinical work and do not commit, push, or deploy without the user's instruction.
