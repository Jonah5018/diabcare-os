# Sprint 25 — Clinical intelligence foundations

IMPLEMENTED: capability-protected, tenant-scoped patient review combining bounded measurement histories, neutral time-spaced weight/glucose/HbA1c charts, explicitly calculated changes, saved consultation previews, recent booking dates, active structured prescriptions and a defined overdue-plan flag. Source identifiers, units, dates, missing-data states, older-record indicators and links back to full histories remain visible.

Code is separated into runtime schemas, types, server queries, deterministic calculations, route/loading UI and focused presentation components. Existing clinical write modules and histories remain intact. No migration is required because there is no new durable state. No dependency, external AI, patient mutation, shared clinical cache or clinical decision automation is added.

See [clinical-review.md](clinical-review.md) for exact bounds, evidence semantics, units, arithmetic, date rules, missing-data handling, future disabled AI boundary and acceptance requirements.

VERIFIED: `npm run verify:clinical-review` and `scripts/verify-clinical-review.sql`, followed by all application suites, lint, build and diff checks. SQL uses synthetic temporary clinics/identities/source records inside BEGIN/ROLLBACK. Existing database/security regression checks remain in place. The review route is dynamically rendered under the existing protected dashboard.

DEFERRED / REQUIRES STAGING: real role sessions, clinician review of source/unit/date semantics, complete source-link/browser layout acceptance and realistic concurrent data volumes. These are disclosed limitations, not proof of a production clinical intelligence system. Medical thresholds, care-gap rules, risk classification and AI suggestions remain disabled/unimplemented pending approved domain/privacy architecture.

This is the final authorized sprint in this checkpoint. Stop here for manual review; do not begin Sprint 26, commit, push or deploy.
