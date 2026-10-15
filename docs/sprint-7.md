# DiabCare OS — Sprint 7 development guide

The local repository is the source of truth. The GitHub default branch does not include all the existing local clinical modules. Keep the original uncommitted work and read AGENTS.md before editing Next.js code.

## Where to edit

| Responsibility | File |
| --- | --- |
| Dashboard counts and clinic-profile guard | app/dashboard/page.tsx |
| Appointment page queries, lists, and status counters | app/dashboard/appointments/page.tsx |
| Authenticated appointment mutations and cache invalidation | actions/appointment.ts |
| Booking validation | lib/validations/appointment.ts |
| Clinic date and appointment display formatting | lib/clinic-date.ts |
| Shared appointment status and form-state types | types/appointment.ts |
| Booking form, feedback, and pending state | components/appointments/appointment-form.tsx |
| Today's appointments, queue actions, and clinical links | components/appointments/queue-list.tsx |
| Future scheduled appointments | components/appointments/upcoming-list.tsx |
| Consistent status labels and colours | components/appointments/appointment-status.tsx |
| Read-only patient appointment history | components/appointments/appointment-history.tsx |
| Patient clinical modules and history query | app/dashboard/patients/[id]/page.tsx |
| Mobile drawer and content width | app/dashboard/layout.tsx |
| Navigation and drawer-close callback | components/dashboard/sidebar.tsx |
| Mobile patient-profile links | components/patients/patient-table.tsx |
| Verified authentication and refreshed cookies | proxy.ts |
| Reusable appointment regression checks | scripts/verify-appointments.cjs |

Keep booking validation in the existing lib/validations folder, server actions in actions, and presentation in components. Share date and status definitions rather than copying them into each component.

## Appointment rules

- The server derives organization_id and created_by from the authenticated user and public.users. Browser-submitted clinic IDs are ignored.
- The clinic day is Africa/Lagos, matching the existing database check_in_appointment RPC.
- Today's Appointments includes scheduled, waiting, in_consultation, and completed visits, and excludes cancelled visits.
- New and future bookings remain scheduled and have no queue number.
- The database RPC assigns queue numbers atomically at check-in. Do not replace it with JavaScript numbering.
- The normal lifecycle is scheduled → waiting → in_consultation → completed.
- Cancellation is an UPDATE from scheduled, waiting, or in_consultation. Completed and cancelled visits are terminal.
- Patient appointment history includes every status, including cancelled visits.
- Vitals and clinical notes remain separate records. The queue provides links to their existing sections; it does not automatically create a clinical record or claim that completion implies saved clinical notes.
- Appointment mutations invalidate the dashboard, appointments page, and patient-profile pages.

## Run checks

From the repository directory:

```powershell
npm run lint
npm run verify:appointments
npm run build
```

The regression script uses the installed TypeScript compiler to execute the real dashboard, validation, and server-action source with database mocks. It checks clinic boundaries, invalid dates/times, cancellation, state guards, and cache invalidation. It does not modify Supabase and does not replace live RLS verification.

Next.js 16.3.3 defaults to spawning a TypeScript CLI subprocess. This Windows environment blocked that process with spawn EPERM. next.config.ts uses experimental.useTypeScriptCli = false and experimental.workerThreads = true so full compiler-API type checking and build workers can run in threads. Type checking remains enabled.

The existing Geist Latin fonts are stored in app/fonts and loaded through next/font/local. Their upstream SIL Open Font License is included alongside the files. Builds no longer need a Google Fonts download.

## Verification performed on 12 October 2026

- Lint, standalone TypeScript checks, appointment regression checks, and the complete production build passed.
- The live appointment schema, lifecycle trigger, indexes, foreign keys, RLS, RPC definition, and RPC execution permissions were inspected.
- Database tests ran as the authenticated role inside a transaction and rolled back all synthetic organisations, auth users, staff, patients, and appointments. Explicit synthetic hospital numbers avoided consuming the hospital-number sequence.
- Tests covered new/future bookings, queue numbers 1/2/3, repeat check-in, clinic-specific numbering, today-only check-in, start/completion timestamps, cancellation from three states, retained cancellation history, terminal-state rejection, invalid transitions, duplicate queue rejection, and clinic isolation for reads, inserts, updates, patient relationships, and RPC calls.
- A follow-up query confirmed no temporary fixtures remained and the original scheduled, completed, and cancelled records remained.
- The authenticated dashboard, booking page, patient profile, and appointment history rendered in the browser.
- Past-date submission was blocked by browser validation; server-side rejection was independently checked by the regression script.
- Mobile navigation closes after selecting a route. Mobile patient cards open the profile.
- Actual pages at 375px and populated queue/upcoming components rendered with synthetic data at 375px and 1280px had no horizontal overflow. Fresh application console checks were clean.
- The formatted vitals components retained the same compiled runtime code.

## Sprint status and deferred acceptance work

Sprint 7 is closed on 14 October 2026 under the user's explicit acceptance of the strongest safe action, regression, and real database verification. The complete isolated multi-role browser walkthrough remains deferred until supported clinic provisioning and staff invitations exist. This is recorded acceptance debt, not a completed browser test. No account was reassigned, tenant isolation was not weakened, and no permanent synthetic records were added to the current clinic.

Deferred walkthrough for the isolated test clinic:

1. Book a visit for the clinic's current day. Confirm it appears as Scheduled, without a queue number, and increases the dashboard count.
2. Book a future visit. Confirm it appears only under Upcoming Appointments and does not increase today's count.
3. Check in three designated test patients. Confirm queue numbers increase in check-in order.
4. Start and complete a visit. Confirm its queue number and patient history are retained.
5. Cancel separate visits from scheduled, waiting, and in_consultation. Confirm the dashboard count decreases and history still contains each cancelled visit.
6. Open vitals and clinical-note links from the queue. Save clinical records through the existing forms and verify the patient folder.
7. Repeat the page interactions on a phone-size viewport and check browser and server logs.

Do not delete existing test records, weaken RLS, install or downgrade packages unnecessarily, or commit/push without the user's instruction.

## Follow-on platform foundations

The subsequent clinic-operations pass completed the clinical validation and role review, replaced development account details with the authenticated clinic profile, and implemented the standalone operations pages. It also applied and saved reproducible migrations for clinical isolation, search, auditing, and relationship indexes. See [Platform foundations](platform-foundations.md) for the current architecture, verification, and capacity limitations.

Earlier database history still needs a reviewed schema baseline before an empty environment can be bootstrapped. The browser appointment acceptance walkthrough above remains deferred and does not block Sprint 8 under the user's revised instruction.
