/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const { load } = require("./source-loader.cjs");
const { authorizeOperations } = load("lib/operations/security.ts");
const secret = "synthetic-operations-secret-32-characters";
const request = new Request("https://example.invalid", { headers: { authorization: "Bearer " + secret } });
assert.equal(authorizeOperations(request, { enabled: false, secret }), false);
assert.equal(authorizeOperations(request, { enabled: true, secret: "short" }), false);
assert.equal(authorizeOperations(new Request("https://example.invalid"), { enabled: true, secret }), false);
assert.equal(authorizeOperations(request, { enabled: true, secret }), true);
assert.equal(authorizeOperations(new Request("https://example.invalid", { headers: { authorization: "Bearer " + "é".repeat(secret.length) } }), { enabled: true, secret }), false);
const lines = [];
const logger = load("lib/observability/events.ts", {}, { console: { info: value => lines.push(value), warn: value => lines.push(value) } });
const uuid = logger.newRequestId();
logger.emitOperationalEvent({ event: "billing_webhook", request_id: uuid, outcome: "failed", token: "PRIVATE TOKEN", patient_note: "PRIVATE NOTE", url: "PRIVATE URL" });
assert.equal(lines.length, 1);
assert.equal(lines[0].includes("PRIVATE"), false);
logger.emitOperationalEvent({ event: "patient secret", request_id: uuid, outcome: "failed" });
assert.equal(lines.length, 1);
const { operationalAlerts } = load("lib/operations/alerts.ts");
assert.equal(operationalAlerts({ failed_notifications: 0, expired_leases: 0, due_notifications: 0, oldest_due_seconds: 0, billing_reconciliation: 0, expired_billing_periods: 0 }).length, 0);
assert.equal(operationalAlerts({ failed_notifications: 1, expired_leases: 1, due_notifications: 1, oldest_due_seconds: 901, billing_reconciliation: 1, expired_billing_periods: 1 }).length, 5);

(async () => {
  let allowed = false;
  let healthy = true;
  let touched = 0;
  const mocks = {
    "@/lib/operations/security": { authorizeOperations: () => allowed },
    "@/lib/observability/events": logger,
    "@/lib/supabase/operations": { createOperationsClient: () => ({ rpc: () => {
      touched += 1;
      const promise = Promise.resolve({ data: { database: "ok", queue_schema: healthy, billing_schema: true }, error: null });
      promise.abortSignal = () => promise;
      return promise;
    } }) },
  };
  const { GET } = load("app/api/internal/readiness/route.ts", mocks);
  assert.equal((await GET(request)).status, 404);
  assert.equal(touched, 0);
  allowed = true;
  const ready = await GET(request);
  assert.equal(ready.status, 200);
  assert.equal(ready.headers.get("cache-control"), "no-store");
  assert.equal(Boolean(ready.headers.get("x-request-id")), true);
  healthy = false;
  assert.equal((await GET(request)).status, 503);
  const publicHealth = load("app/api/health/route.ts", { "@/lib/observability/events": logger });
  assert.equal((await publicHealth.GET()).status, 200);
  const hook = load("instrumentation.ts", { "@/lib/observability/events": logger });
  hook.onRequestError(new Error("PRIVATE CLINICAL NOTE"), { path: "PRIVATE TOKEN", headers: {} }, { routeType: "render" });
  hook.onRequestError(new Error("PRIVATE NOTE"), { path: "/dashboard/patients/example", headers: { "x-request-id": uuid } }, { routeType: "render" });
  assert.equal(JSON.parse(lines.at(-1)).request_id, uuid);
  assert.equal(lines.some(line => line.includes("PRIVATE")), false);
  console.log("PASS: disabled/constant-time worker guards, runtime log allowlist and redaction, meaningful alert thresholds, protected/readiness failures, correlation IDs, public liveness and safe framework error capture.");
})().catch(error => { console.error(error); process.exitCode = 1; });
