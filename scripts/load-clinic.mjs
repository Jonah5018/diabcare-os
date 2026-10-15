import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { runWorkload } from "./performance/engine.mjs";
import { assertLoadTarget, verifySyntheticMembership } from "./performance/safety.mjs";
import { createScenarios } from "./performance/scenarios.mjs";

const execute = process.argv.includes("--execute");
const writes = process.argv.includes("--include-writes");

if (!execute) {
  console.log(JSON.stringify({ mode: "plan_only", networkRequests: 0, writes: false, requires: "Isolated project, reviewed synthetic fixtures and invited staff tokens; see docs/performance.md" }));
} else {
  try {
    const fixture = JSON.parse(await readFile(process.env.DIABCARE_LOAD_FIXTURE_FILE ?? "", "utf8"));
    const url = assertLoadTarget(fixture, process.env, writes);
    const roles = ["doctor", "organization_admin", ...(writes ? ["lab_scientist"] : [])];
    if (process.env.DIABCARE_LOAD_PLATFORM_OWNER_TOKEN) roles.push("platform_owner");
    const clients = {};
    const actors = {};

    for (const role of roles) {
      const token = process.env[`DIABCARE_LOAD_${role.toUpperCase()}_TOKEN`];
      if (!token) throw new Error("Missing controlled staff token.");
      const client = createClient(url, process.env.DIABCARE_LOAD_PUBLIC_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([AbortSignal.timeout(10000), ...(init?.signal ? [init.signal] : [])]) }),
        },
      });
      actors[role] = await verifySyntheticMembership(client, token, fixture, role);
      clients[role] = client;
    }

    const workload = createScenarios({ clients, actors, fixture, writes });
    const result = await runWorkload({
      scenarios: workload.scenarios,
      requests: Number(process.env.DIABCARE_LOAD_REQUESTS ?? 50),
      concurrency: Number(process.env.DIABCARE_LOAD_CONCURRENCY ?? 4),
    });
    console.log(JSON.stringify({ ...result, integrity: workload.verify() }, null, 2));
    if (result.failures) process.exitCode = 1;
  } catch {
    console.error("Load run refused or failed. Check isolated fixture, role prerequisites, configuration and redacted metrics; never print tokens or patient rows.");
    process.exitCode = 1;
  }
}
