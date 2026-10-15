/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const { load } = require("./source-loader.cjs");
const { can } = load("lib/auth/permissions.ts");
const { runNotificationBatch } = load("lib/notifications/worker.ts");
const uuid = "12345678-1234-4234-8234-123456789abc";
assert.equal(can("doctor", "notifications:manage"), false);
assert.equal(can("receptionist", "notifications:view"), true);

(async () => {
  const calls = [];
  let uncertain = false;
  const client = { rpc: async (name, parameters) => {
    calls.push([name, parameters]);
    if (name === "claim_notification_jobs") return { data: [{ id: uuid, lease_token: uuid, provider: "in_app" }], error: null };
    if (name === "deliver_in_app_notification") return { data: "delivered", error: uncertain ? {} : null };
    return { error: null };
  } };
  assert.equal((await runNotificationBatch(client)).delivered, 1);
  assert.equal(calls[0][1].p_limit, 10);
  assert.equal("p_organization_id" in calls[0][1], false);
  uncertain = true;
  const result = await runNotificationBatch(client);
  assert.equal(result.delivered, 0);
  assert.equal(result.uncertain, 1);
  assert.equal(calls.some(call => call[0] === "fail_notification_attempt"), true);
  let touched = false;
  const actions = load("actions/notification.ts", {
    "@/lib/auth/context": { getClinicContext: async () => ({ profile: { role: "doctor" }, supabase: { rpc: () => { touched = true; } } }) },
    "next/cache": { revalidatePath() {} },
  });
  assert.equal(Boolean((await actions.queueClinicNotice(new FormData())).error), true);
  assert.equal(touched, false);
  console.log("PASS: notification role gates, fixed job batch, lease-only provider request, no browser clinic fields, persisted delivery and uncertain-outcome handling.");
})().catch(error => { console.error(error); process.exitCode = 1; });
