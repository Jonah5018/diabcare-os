# Disaster recovery runbook

Owner: platform operations. Status: implemented runbook and verification tooling; actual backup availability and restoration remain unverified. No paid backup/PITR feature was enabled. Do not execute a destructive restore against the current project without explicit incident authorization.

## Recovery objectives and evidence

RPO is the maximum acceptable loss of committed data measured backward from an incident. RTO is elapsed time from declaring recovery until verified service restoration, including validation and cutover. Neither is currently a demonstrated guarantee.

Planning targets requiring approval and a measured drill: database RPO ≤24 hours, document bytes/metadata RPO ≤24 hours at a consistent recovery point, and service RTO ≤8 hours. If clinical operations require less loss/downtime, select a funded PITR/object-copy architecture first. Actual RPO/RTO are unknown until backup coverage, age, consistency and restore duration are evidenced. Database PITR alone cannot satisfy document recovery.

The connected project was observed healthy on PostgreSQL 17 in eu-central-1. This observation does not reveal the paid plan, backup retention, latest successful backup, PITR availability or restore rights. An operator must record these in an access-controlled recovery evidence register, not infer them from project health.

## Backup inventory

| Asset | Required recovery source | Evidence required |
| --- | --- | --- |
| Application/public/private schemas and data | Provider backup or encrypted consistent logical backup | Timestamp, integrity digest, retention, encryption/key custody, successful restore |
| Auth identities and supported session data | Supported provider restore covering Auth | Identity/profile ID relationships and controlled sign-in test |
| Document file bytes | Separate encrypted object backup/versioned off-site copy | Bucket/path, size, content checksum, capture time, bytes present |
| Storage metadata and custom policies | Database backup plus reviewed customizations | Reconcile metadata and bytes at the chosen point |
| Migration history | DB history plus repository manifest | Versions/names and immutable file hashes |
| App/secret/configuration | Approved source checkpoint and secret manager | Region/runtime, public project mapping, backend/signing secrets, Auth/SMTP/redirect configuration |
| External billing state | Canonical provider state plus ledger/bindings | Verified event replay/reconciliation, no browser-authorized state |

Database backups include Storage metadata, not Storage file bytes. A metadata row or signed URL is not a file backup. Do not store dumps, Auth identities, documents or secret exports in this repository, CI artifacts or ordinary tickets. Use encrypted access-controlled storage with separate credentials/key recovery and an approved retention policy.

## Configure manually before a pilot

1. In Supabase Database → Backups, verify plan, actual successful backups, retention and restore options. Evaluate PITR against approved RPO/cost; no purchase is authorized by this runbook.
2. Establish encrypted off-site logical backups where required by the plan/recovery design. Use the installed CLI's `--help` and current provider guide, with credentials from approved tooling rather than pasted command arguments/shell history. Include public/private application objects, supported Auth/Storage customizations and migration history. Verify the dump's actual contents; a default schema dump may exclude managed schemas.
3. Establish a separate document object backup and integrity manifest. Use authorized Storage APIs to copy bytes; never treat `storage.objects` rows as the files. Define pending-upload and missing-object handling and retain a consistent timestamp with the database backup.
4. Record Auth provider configuration, trusted callback URLs, confirmation/password settings, SMTP, hosting region/runtime/build configuration, custom domains and DNS ownership. Store secret values only in the secret manager; `.env.example` is a name inventory, not a recovery copy.
5. App switches for billing and operations remain false during recovery. Do not bring old webhook/worker endpoints online automatically.

## Original-schema baseline gap

The 26 migrations present at Sprint 21 began after original schema provisioning; Sprint 23 adds one forward grant-hardening migration, bringing the reviewed inventory to 27. Replaying these into an empty database is not a supported bootstrap and this runbook does not pretend otherwise.

Choose one reviewed path:

- Incident recovery: restore a verified provider snapshot into an isolated recovery project, retaining migration history; compare its inventory with the recorded application checkpoint before forward migrations.
- Fresh bootstrap: capture a schema-only export from an authorized source at an identified migration head, review extensions, types, functions, grants, RLS, triggers and custom managed-schema policies, then test it against a clean compatible Supabase environment. Store the approved snapshot as a versioned bootstrap artifact with checksums and a clear “includes migrations through version X” boundary. Never replay those same migrations on top of that snapshot. Adopt/reconcile history only in the newly created isolated target after review; do not repair or rewrite current project history.

Do not manufacture an earlier baseline migration by guessing missing tables. No `db reset`, project restore, schema dump containing real data, history repair or destructive SQL was run in this implementation. Actual baseline capture/clean bootstrap is deferred because an isolated target and authorized recovery credentials are not configured.

## Restore procedure

1. Incident lead records scope, last known good time, suspected compromise and authorization. Freeze application writes/worker/webhook traffic through deployment operations; preserve existing evidence/backups. Do not delete data to hide the incident.
2. Prepare an isolated compatible target with outbound email, external notifications, billing hooks and public access disabled. Confirm target identity independently; never paste source credentials into a public console.
3. Select a known-good backup within the approved objective. Verify its digest/decryption and provider restore instructions. Restore database and supported Auth/Storage metadata; restore custom configuration and keys using the provider-supported approach. Vault/encrypted values and custom database-role passwords need separately reviewed key/password recovery.
4. Restore document bytes to exact reviewed paths. Reconcile ready metadata to actual bytes, sizes and checksums. Do not mark missing/pending objects ready or overwrite current files silently. An administrator must resolve mismatches before download acceptance.
5. Restore the corresponding source checkpoint and compare migration versions/names plus hashes. Apply only missing forward migrations after checking compatibility. Run `node scripts/recovery-manifest.mjs` to inventory files; compare remote history independently. This command performs no backup or restore.
6. Reconfigure trusted Auth origins/redirects/email and server secrets for the target. Decide whether recovery requires credential rotation/session revocation based on the incident. Old signed file URLs may persist until expiry; do not claim instantaneous revocation. Verify patient authorship still references the original identity UUIDs; do not remap accounts manually.
7. Keep notification processing disabled until classifying leased/unknown/submitted work. Expired leases recover through the existing token-aware claim path. Internal inbox delivery is idempotent; future external transports require provider receipt reconciliation before replay. Restored billing ledgers may lag the provider: verify controlled bindings and replay signed verified events/canonical state without inventing paid access or deleting ledger rows.
8. Run read-only recovery SQL, advisors and all application/database suites in the isolated target. Perform controlled role-specific clinical/document/Auth journeys. Measure data-point ages and elapsed time; record actual RPO/RTO, discrepancies and explicit acceptance.
9. Only then obtain cutover authorization, change environment/DNS as applicable, reopen writes and narrowly re-enable verified processors. Monitor failures, tenant denial and backlog. Preserve the old source and rollback route until accepted.

## Recovery acceptance record

Record incident/drill ID, authorized target, source checkpoint, backup point and capture time, object-copy point, digest verification, restore start/end, validation end, identities/relationships, tenant/role denial, documents, audit, queue/billing reconciliation and operator sign-off. Do not put names/clinical rows/secrets in the public record. Include untested items; passing inventory checks is not proof of data consistency or recovery duration.

## Safe checks delivered

- `node scripts/recovery-manifest.mjs`: local migration versions/names/SHA-256; contains no clinical data or credentials.
- `npm run verify:recovery`: integrity/alignment/duplicate/change-detection tests.
- `scripts/verify-recovery.sql`: read-only required schema, RLS, bucket and protected-grant assertions. It does not validate file bytes or issue a restore.

Provider references: [database backups](https://supabase.com/docs/guides/platform/backups), [supported backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Confirm current options for the actual plan. This runbook is not a certified disaster-recovery guarantee.
