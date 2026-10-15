import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareMigrationHistory, recoveryManifest } from "./lib/recovery-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventory = await recoveryManifest(root);
assert.equal(inventory.restoreDrill, "not-performed");
assert.equal(inventory.migrations.every(row => /^[a-f0-9]{64}$/.test(row.sha256)), true);
assert.equal(compareMigrationHistory(inventory, inventory.migrations), true);
assert.equal(compareMigrationHistory(inventory, inventory.migrations.slice(1)), false);
assert.equal(compareMigrationHistory(inventory, [...inventory.migrations, inventory.migrations[0]]), false);
assert.equal(JSON.stringify(inventory).includes("postgresql://"), false);

const fixture = await mkdtemp(path.join(tmpdir(), "diabcare-recovery-"));
try {
  await mkdir(path.join(fixture, "supabase", "migrations"), { recursive: true });
  await assert.rejects(() => recoveryManifest(fixture), /empty/);
  await writeFile(path.join(fixture, "supabase", "migrations", "20261015000000_test.sql"), "select 1;\n");
  const first = await recoveryManifest(fixture);
  await writeFile(path.join(fixture, "supabase", "migrations", "20261015000000_test.sql"), "select 2;\n");
  assert.notEqual(first.migrations[0].sha256, (await recoveryManifest(fixture)).migrations[0].sha256);
  await writeFile(path.join(fixture, "supabase", "migrations", "20261015000000_duplicate.sql"), "select 1;\n");
  await assert.rejects(() => recoveryManifest(fixture), /duplicate/);
} finally {
  if (path.dirname(fixture) !== path.resolve(tmpdir()) || !path.basename(fixture).startsWith("diabcare-recovery-")) {
    throw new Error("Refusing cleanup outside the named recovery fixture directory.");
  }
  await rm(fixture, { recursive: true, force: true });
}

console.log("PASS: recovery inventory integrity, migration alignment comparison, duplicate rejection and changed-content detection. No restore or database access performed.");
