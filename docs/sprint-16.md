# Sprint 16 — Secure clinical document storage

Implemented 14 October 2026 from the master roadmap. Patient folders now include an independent Patient Documents module with category, filename, media type, size, recorded time, upload state, pagination and private download controls. Structured clinical modules remain intact. Documents are attachments, not another free-text clinical record.

## Storage and ownership

The new `clinical-documents` bucket is PRIVATE with a 768 KiB (786,432-byte) per-file maximum and exactly PDF, PNG and JPEG allowed MIME types. This initial limit fits beneath the installed Next.js default 1 MiB Server Action request limit, without increasing global request limits or adding dependencies. Larger-file/resumable infrastructure is a future extension.

`clinical_documents` metadata records clinic, patient, uploader, idempotency request, neutral display name, category, media type, size, SHA-256 checksum, generated path, pending/ready state and created/updated timestamps. Patient and uploader composite foreign keys include organization. Paths are database-generated `organizationUUID/patientUUID/documentUUID.ext`, with a CHECK enforcing the exact shape. Submitted paths, actor IDs and organization IDs are ignored. Names are sanitized for display and never used as object paths. Bucket/object URLs are never public.

`documents:view` is explicit for all existing active clinic staff, following existing patient-record visibility. `documents:upload` is explicit for platform owners, clinic admins, doctors, nurses and laboratory scientists. Receptionists can read ready clinic documents but cannot reserve/upload/finalize. These capabilities appear in the canonical role matrix; existing clinical grants are unchanged.

Metadata SELECT is restricted to the active clinic. Direct metadata DML is revoked. Empty-search-path guarded private commands and invoker wrappers recheck active database identity, role and clinic/patient ownership. PUBLIC/anonymous execution is revoked. Storage INSERT permits only the uploader's exact pending reservation path, with current upload authority and matching ownership. SELECT permits ready clinic files, or pending files for their uploader/clinic administrators. No Storage UPDATE/upsert or DELETE policy is added. No service-role credential is used.

## Upload, retry and verification

The application checks size, declared MIME and PDF/PNG/JPEG header signatures before upload, and records a checksum. Reservation is idempotent per actor/clinic/request UUID. Reusing an identifier with changed patient, name, category, type, size or checksum is rejected. A serialized per-uploader check bounds pending reservations to ten; existing retries are allowed even at that limit.

Uploads never overwrite. A conflict or uncertain response triggers authenticated retrieval and size/signature/checksum comparison before finalization. Separate Resume verification controls recover already-stored pending objects. The uploader can also reselect the original file against the original reservation after a refresh; administrators can verify another uploader's stored object but cannot silently replace it. Missing objects stay pending. Changed inputs need a new request. There is no automatic orphan deletion or deletion of real records.

Finalization independently checks Storage provider object metadata: expected bucket/path/owner, size and MIME. It marks ready only after those match. The database cannot inspect blob bytes. Authorized clients calling Storage/RPC directly remain governed by tenant/path/role and provider size/MIME restrictions, but can bypass application byte-header/checksum checks. Header checks are not structural file validation or malware scanning; neither malware scanning nor a quarantine service is claimed. Adding a scanner later requires an enforced quarantine/release architecture, not a display badge.

## Private access and audit

The application checks active clinic ownership and ready state, records an ACCESS request, then asks the authenticated Storage client for a 60-second signed URL with forced download. Audit failure blocks link issuance. Links remain only in transient component state, expire in the UI and are not saved in metadata or logs. No inline clinical previews or public URLs are generated.

A signed URL is a bearer link until it expires, including after an account is deactivated. Do not share it. The 60-second duration is the application policy; authorized callers with Storage SELECT may independently request URLs using the provider API. Storage RLS protects issuance/authorized reads, not already issued bearer tokens.

Document audit details contain only status transitions/category/MIME and access-request stage, plus normal actor/record/clinic IDs and timestamps. Names, object paths, checksums, bytes and clinical text are excluded. ACCESS means requested, not actual download/opening. Raw provider reads/signing outside the application are not automatically represented as these application audit events.

## Maintenance map

- `lib/documents/config.ts`: one source for bucket/type/category/application size/link limits.
- `lib/validations/document.ts`, `types/document.ts`: structured input/row validation and action types.
- `lib/documents/file.ts`: safe names, byte signatures and checksums; server-only.
- `lib/documents/queries.ts`: scoped 25+1 keyset history and document lookup.
- `lib/documents/storage.ts`: authenticated stored-object verification and finalization.
- `actions/document.ts`: upload/resume/audited signed access with safe failures.
- `components/documents/`: independent module, upload/retry forms, history and access controls.
- Patient profile: Suspense integration and independent `documentCursor`, preserving other history cursors.
- `scripts/verify-documents.{cjs,sql}`: file/action/query/render and rolled-back Storage metadata/RLS tests.

Applied migrations:

- `20261014113320_private_patient_clinical_document_storage.sql`
- `20261014113510_cover_clinical_document_patient_foreign_key.sql`

The second migration adds the patient-first composite FK index identified by the advisor; the existing clinic/patient/time page index remains useful for history. Earlier applied migrations were not rewritten. README, scripts and CI include `verify:documents`. The verification harness supports native Node APIs without adding packages.

## Acceptance and limits

Tests pass for private bucket settings, derived ownership/path, tenant-safe constraints, roles, idempotency/conflicts, missing/wrong objects, pending limits, no overwrites/deletes, minimal audit, safe file validation, retry, fixed history bounds, audited expiring downloads and failure states. SQL objects are metadata fixtures only and all roll back. No physical synthetic blobs or permanent patient/staff records were created.

Real Storage API byte transfer, signed-link delivery/expiry and desktop/mobile multi-role browser walkthroughs remain unverified. Validate those in an isolated clinic with controlled accounts and permitted browser access. No malware scan, larger-file pipeline, immutable archive, retention deletion or production capacity claim is included.

Proposed commit: `feat: add tenant-safe private patient documents`.
