import assert from "node:assert/strict";
import { runWorkload, summarize } from "./performance/engine.mjs";
import { assertLoadTarget } from "./performance/safety.mjs";
import { createScenarios } from "./performance/scenarios.mjs";

const metrics = summarize([1, 2, 3, 4, 100].map((durationMs, index) => ({ durationMs, ok: index !== 4 })));
assert.equal(metrics.p50Ms, 3);
assert.equal(metrics.p95Ms, 100);
assert.equal(metrics.p99Ms, 100);
assert.equal(metrics.errorRate, 0.2);
assert.equal(summarize([]).p99Ms, null);

let concurrent = 0;
let peak = 0;
const run = await runWorkload({ requests: 13, concurrency: 3, scenarios: [{ name: "synthetic", run: async index => {
  concurrent++;
  peak = Math.max(peak, concurrent);
  await Promise.resolve();
  concurrent--;
  if (index % 4 === 0) throw new Error("private detail must not appear");
} }] });
assert.equal(run.requests, 13);
assert.equal(run.failures, 4);
assert.equal(peak <= 3, true);
assert.equal(JSON.stringify(run).includes("private detail"), false);
await assert.rejects(() => runWorkload({ requests: 1001, concurrency: 1, scenarios: [] }));
await assert.rejects(() => runWorkload({ requests: 1, concurrency: 9, scenarios: [] }));

const fixture = {
  syntheticOnly: true, projectRef: "abcdefghijklmnopqrst", expectedSlug: "diabcare-load-acceptance",
  organizationId: "11111111-1111-4111-8111-111111111111",
  patientId: "22222222-2222-4222-8222-222222222222",
  consultationId: "33333333-3333-4333-8333-333333333333",
};
const environment = { DIABCARE_LOAD_APPROVAL: "isolated-synthetic-only", DIABCARE_LOAD_PUBLIC_KEY: "sb_publishable_synthetic" };
assert.equal(assertLoadTarget(fixture, environment, false), "https://abcdefghijklmnopqrst.supabase.co");
assert.throws(() => assertLoadTarget({ ...fixture, projectRef: "umjstkpzszfzoiqesxob" }, environment, false), /protected/);
assert.throws(() => assertLoadTarget(fixture, environment, true), /write approval/);
assert.throws(() => assertLoadTarget(fixture, { ...environment, DIABCARE_LOAD_PUBLIC_KEY: "sb_secret_never-allowed" }, false), /public/);
assert.throws(() => assertLoadTarget({ ...fixture, syntheticOnly: false }, environment, false), /synthetic/);

const calls = [];
let queue = 0;
const client = {
  from(table) {
    const query = {
      select() { return query; },
      eq(column, value) { calls.push({ column, value }); return query; },
      ilike() { return query; },
      order() { return query; },
      limit(value) { assert.equal(value <= 26, true); return query; },
      insert(row) { calls.push({ table, row }); return query; },
      single: async () => ({ data: { id: `appointment-${queue}` }, error: null }),
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
    };
    return query;
  },
  async rpc(name, parameters) {
    calls.push({ name, parameters });
    return { data: [{ queue_number: ++queue }], error: null };
  },
};
const scenarios = createScenarios({
  clients: { doctor: client, organization_admin: client, lab_scientist: client },
  actors: { doctor: "doctor", organization_admin: "admin", lab_scientist: "lab" },
  fixture,
  writes: true,
});
for (const scenario of scenarios.scenarios) await scenario.run();
assert.equal(scenarios.verify().queueUniqueness, "passed");
assert.equal(calls.some(call => call.column === "organization_id" && call.value === fixture.organizationId), true);
assert.equal(calls.find(call => call.name === "get_patient_timeline").parameters.p_limit, 26);
assert.equal(calls.find(call => call.table === "laboratory_results").row.recorded_by, "lab");
assert.equal(calls.find(call => call.name === "create_prescription").parameters.p_consultation_id, fixture.consultationId);
console.log("PASS: percentile/error accounting, bounded concurrency, redacted failures, protected-project refusal and explicit synthetic/write/public-key guards. No network/load writes executed.");
