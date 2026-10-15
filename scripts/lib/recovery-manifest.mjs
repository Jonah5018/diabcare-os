import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function recoveryManifest(root) {
  const directory = path.join(root, "supabase", "migrations");
  const entries = await readdir(directory, { withFileTypes: true });
  const migrations = [];
  const versions = new Set();

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.name.endsWith(".sql")) continue;
    const match = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(entry.name);
    if (!entry.isFile() || !match || versions.has(match[1])) {
      throw new Error("Migration inventory contains an invalid or duplicate version.");
    }

    versions.add(match[1]);
    const bytes = await readFile(path.join(directory, entry.name));
    migrations.push({
      version: match[1],
      name: match[2],
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }

  if (!migrations.length) throw new Error("Migration inventory is empty.");

  return {
    format: 1,
    purpose: "Migration integrity inventory; not a database or Storage backup",
    baseline: "reviewed-original-schema-baseline-required",
    restoreDrill: "not-performed",
    migrations,
  };
}

export function compareMigrationHistory(local, remote) {
  if (!Array.isArray(remote)) throw new Error("Expected an array of remote migration versions/names.");
  const actual = remote.map(row => `${row.version}_${row.name}`).sort();
  const expected = local.migrations.map(row => `${row.version}_${row.name}`).sort();

  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
