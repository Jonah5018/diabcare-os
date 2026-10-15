/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");
const { auditFilters, auditQuery } = load("lib/audit/filters.ts");
const { auditCsv } = load("lib/audit/csv.ts");
const { retentionDraftSchema } = load("lib/validations/audit.ts");
const uuid = "12345678-1234-4234-8234-123456789abc";
const filters = auditFilters({ from: "2026-10-01", to: "2026-10-14", actor: uuid, entity: "appointments", operation: "UPDATE" });
assert.equal(filters.startTime, "2026-09-30T23:00:00.000Z");
assert.equal(auditQuery(filters).actor, uuid);
for (const bad of [{ actor: "eq.attack" }, { entity: "secrets" }, { operation: "UPSERT" }, { cursor: "invalid" }, { from: "2026-01-01", to: "2026-10-14" }]) {
  assert.throws(() => auditFilters({ from: "2026-10-01", to: "2026-10-14", ...bad }));
}
const row = { id: uuid, actor_id: uuid, record_id: uuid, entity_type: "appointments", operation: "UPDATE",
  created_at: "2026-10-14T08:00:00Z", actor: { full_name: "PRIVATE NAME" },
  details: { previous_status: "waiting", status: '=HYPERLINK("evil")', note: "PRIVATE NOTE", role: "doctor" } };
const csv = auditCsv([row]);
assert.equal(csv.includes("PRIVATE"), false);
assert.equal(csv.includes("' ="), false);
assert.equal(csv.includes("'=HYPERLINK"), true);
assert.equal(csv.includes('""evil""'), true);
assert.equal(retentionDraftSchema.parse({ days: "", hold: true }).days, null);
assert.equal(retentionDraftSchema.safeParse({ days: "0", hold: false }).success, false);

(async () => {
  const calls = [];
  const query = { then(resolve) { return Promise.resolve(resolve({ data: [row], error: null })); } };
  for (const method of ["select", "eq", "gte", "lt", "order", "limit", "or"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  let permission;
  const { getAuditPage } = load("lib/audit/queries.ts", {
    "@/lib/auth/context": { requirePermission: async value => { permission = value; return { profile: { organization_id: uuid }, supabase: { from: () => query } }; } },
  });
  await getAuditPage(filters, true);
  assert.equal(permission, "audit:export");
  assert.equal(calls.some(call => call[0] === "limit" && call[1] === 201), true);
  assert.equal(calls.some(call => call[0] === "eq" && call[1] === "organization_id" && call[2] === uuid), true);
  assert.equal(calls.some(call => call[0] === "eq" && call[1] === "actor_id"), true);
  const Events = load("components/audit/audit-events.tsx", {
    "next/link": { __esModule: true, default: props => React.createElement("a", props) },
    "@/components/audit/audit-details": { __esModule: true, default: () => null },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Events, { rows: [row], query: auditQuery(filters) }));
  assert.equal(html.includes("record="), true);
  const callsRpc = [];
  const { saveRetentionDraft } = load("actions/audit.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/context": { getClinicContext: async () => ({ profile: { role: "doctor" }, supabase: { rpc: (...args) => callsRpc.push(args) } }) },
  });
  assert.equal(Boolean((await saveRetentionDraft(new FormData())).error), true);
  assert.equal(callsRpc.length, 0);
  let exportRole = "organization_admin";
  let auditFailed = false;
  const exportCalls = [];
  const { POST } = load("app/dashboard/audit/export/route.ts", {
    "@/lib/auth/context": { getClinicContext: async () => ({ profile: { role: exportRole },
      supabase: { rpc: async (...args) => { exportCalls.push(args); return { error: auditFailed ? {} : null }; } } }) },
    "@/lib/audit/queries": { getAuditPage: async () => ({ rows: [row], hasMore: true }) },
  });
  const request = (origin = "https://clinic.example", from = "2026-10-01") => {
    const body = new FormData();
    body.set("from", from); body.set("to", "2026-10-14");
    return new Request("https://clinic.example/dashboard/audit/export", { method: "POST", headers: { origin }, body });
  };
  assert.equal((await POST(request("https://foreign.example"))).status, 403);
  assert.equal(exportCalls.length, 0);
  exportRole = "doctor";
  assert.equal((await POST(request())).status, 403);
  assert.equal(exportCalls.length, 0);
  exportRole = "organization_admin";
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-audit-has-more"), "true");
  assert.equal(Boolean(response.headers.get("x-audit-next-cursor")), true);
  assert.equal((await response.text()).includes("PRIVATE"), false);
  assert.equal(exportCalls[0][0], "record_audit_export_request");
  auditFailed = true;
  assert.equal((await POST(request())).status, 400);
  assert.equal((await POST(request("https://clinic.example", "invalid"))).status, 400);
  console.log("PASS: strict audit filters/date/cursor, clinic-scoped bounded query, capability guard, privacy/formula-safe CSV, transition links, retention validation, POST export origin/role guards, next-page headers and audit failure denial.");
})().catch(error => { console.error(error); process.exitCode = 1; });
