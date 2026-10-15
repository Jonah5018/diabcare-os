import path from "node:path";
import { fileURLToPath } from "node:url";
import { recoveryManifest } from "./lib/recovery-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  console.log(JSON.stringify(await recoveryManifest(root), null, 2));
} catch {
  console.error("Recovery manifest generation failed. Inspect migration filenames and file access.");
  process.exitCode = 1;
}
