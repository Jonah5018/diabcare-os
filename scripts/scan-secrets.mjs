import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { credentialPatterns } from "./lib/credential-patterns.mjs";

const root = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
let input = "";
for await (const chunk of process.stdin) input += chunk;
const candidates = [...new Set(input.split(/\r?\n/).filter(Boolean))];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".sql", ".css", ".yml", ".yaml", ".toml", ".example"]);
let checked = 0;
const findings = [];

try {
  if (!candidates.length) throw new Error("Pipe Git candidate filenames into this scanner.");
  for (const filename of candidates) {
    const resolved = await realpath(path.resolve(root, filename));
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Candidate is outside the repository.");
    if (!textExtensions.has(path.extname(filename)) && ![".gitignore"].includes(filename)) continue;

    const source = await readFile(resolved, "utf8");
    checked++;
    for (const category of credentialPatterns(source)) findings.push({ file: filename, category });
  }
  console.log(JSON.stringify({ checkedTextFiles: checked, findings, scope: "high-confidence pattern scan; not a proof that every secret is absent" }, null, 2));
  if (findings.length) process.exitCode = 1;
} catch {
  console.error("Credential scan could not complete. Check Git candidate paths and repository access.");
  process.exitCode = 1;
}
