/* eslint-disable @typescript-eslint/no-require-imports -- Security boundary regression using the existing source harness. */
const assert = require("node:assert/strict");
const { load } = require("./source-loader.cjs");

const appointmentId = "11111111-1111-4111-8111-111111111111";
let mode = "returned";
let calls = 0;
const secret = "PRIVATE_DATABASE_VALUE";
const query = {
  update() { return query; },
  eq() { return query; },
  in() { return query; },
  select() { return query; },
  async maybeSingle() {
    calls++;
    if (mode === "thrown") throw new Error(secret);
    return { data: null, error: { message: secret } };
  },
};
const client = {
  from: () => query,
  async rpc() {
    calls++;
    if (mode === "thrown") throw new Error(secret);
    return { error: { message: secret } };
  },
};
const actions = load("actions/appointment.ts", {
  "@/lib/auth/context": { getClinicContext: async () => ({ supabase: client, profile: { role: "doctor", organization_id: "synthetic" } }) },
  "next/cache": { revalidatePath() {} },
});

(async () => {
  const { credentialPatterns } = await import("./lib/credential-patterns.mjs");
  assert.equal(credentialPatterns("safe public placeholders").length, 0);
  assert.equal(credentialPatterns("sb_secret_" + "x".repeat(32))[0], "supabase-server-secret");
  assert.equal(credentialPatterns("-----BEGIN " + "PRIVATE KEY-----")[0], "private-key");
  const fixtureJwt = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") + "." + "x".repeat(32);
  assert.equal(credentialPatterns(fixtureJwt).includes("non-public-jwt"), true);
  for (mode of ["returned", "thrown"]) {
    for (const action of [actions.checkInAppointment, actions.startConsultation, actions.completeAppointment, actions.cancelAppointment]) {
      await assert.rejects(() => action(appointmentId), error => !error.message.includes(secret) && /could not be confirmed/.test(error.message));
    }
  }
  const before = calls;
  await assert.rejects(() => actions.checkInAppointment("malformed"), /Invalid appointment/);
  await assert.rejects(() => actions.cancelAppointment("malformed"), /Invalid appointment/);
  assert.equal(calls, before);
  console.log("PASS: credential-pattern detection; appointment identifiers validated before database calls; returned and thrown provider/database details are redacted across lifecycle actions.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
