/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { load } = require("./source-loader.cjs");
const { stripeBillingProvider } = load("lib/billing/stripe.ts");
const secret = "synthetic-signing-secret-for-tests-only";
const now = 1780000000;
const body = JSON.stringify({ id: "evtSynthetic", created: now, type: "customer.subscription.updated", data: { object: {
  id: "sub_Synthetic", customer: "cus_Synthetic", status: "active", trial_end: null,
  items: { data: [{ price: { id: "price_Synthetic" }, current_period_end: now + 3600 }] },
} } });
const signature = "t=" + now + ",v1=" + createHmac("sha256", secret).update(`${now}.${body}`).digest("hex");
const provider = stripeBillingProvider(secret, { price_Synthetic: "plus" });
const event = provider.verifyAndNormalize(body, signature, now);
const { billingEventFingerprint } = load("lib/billing/fingerprint.ts");
assert.equal(billingEventFingerprint(event), billingEventFingerprint({ periodEndsAt: event.periodEndsAt, ...event }));
assert.notEqual(billingEventFingerprint(event), billingEventFingerprint({ ...event, status: "cancelled" }));
assert.equal(event.plan, "plus");
assert.equal(event.status, "active");
assert.equal(event.provider, "stripe");
assert.throws(() => provider.verifyAndNormalize(body + " ", signature, now));
assert.throws(() => provider.verifyAndNormalize(body, signature, now + 301));
assert.throws(() => provider.verifyAndNormalize(body, "t=" + now + ",v1=bad", now));
assert.throws(() => stripeBillingProvider(secret, {}).verifyAndNormalize(body, signature, now));

(async () => {
  const { boundedRequestText } = load("lib/http/body.ts");
  await assert.rejects(() => boundedRequestText(new Request("https://example.invalid", { method: "POST", body: "12345" }), 4));
  assert.equal(await boundedRequestText(new Request("https://example.invalid", { method: "POST", body: body })), body);
  const calls = [];
  const { POST } = load("app/api/billing/webhook/route.ts", {
    "@/lib/billing/provider": { configuredBillingProvider: () => provider },
    "@/lib/supabase/operations": { createOperationsClient: () => ({ rpc: async (...args) => { calls.push(args); return { data: "applied", error: null }; } }) },
  });
  const fresh = Math.floor(Date.now() / 1000);
  const freshSignature = "t=" + fresh + ",v1=" + createHmac("sha256", secret).update(`${fresh}.${body}`).digest("hex");
  const response = await POST(new Request("https://example.invalid/api/billing/webhook", { method: "POST", headers: { "stripe-signature": freshSignature }, body }));
  assert.equal(response.status, 200);
  assert.equal(calls[0][1].p_provider, "stripe");
  assert.equal("p_organization_id" in calls[0][1], false);
  assert.equal((await POST(new Request("https://example.invalid", { method: "POST", body }))).status, 400);
  assert.equal(calls.length, 1);
  console.log("PASS: raw-body HMAC/timestamp validation, provider normalization and price mapping, bounded requests, signed webhook contract and no browser clinic/payment authority.");
})().catch(error => { console.error(error); process.exitCode = 1; });
