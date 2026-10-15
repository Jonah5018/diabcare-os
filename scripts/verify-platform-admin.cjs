/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const { load } = require("./source-loader.cjs");
const { can } = load("lib/auth/permissions.ts");
const { clinicStatusSchema } = load("lib/validations/platform.ts");
const uuid = "12345678-1234-4234-8234-123456789abc";
assert.equal(can("organization_admin", "platform:manage"), false);
assert.equal(can("platform_owner", "platform:view"), true);
assert.equal(clinicStatusSchema.safeParse({ clinic_id: uuid, status: "suspended", expected: "active", reason: "security_review" }).success, true);
assert.equal(clinicStatusSchema.safeParse({ clinic_id: uuid, status: "suspended", expected: "active", reason: "private patient note" }).success, false);

(async () => {
  let status = "suspended";
  const mocks = {
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: uuid } }, error: null }) },
      from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { id: uuid, organization_id: uuid, role: "platform_owner", is_active: true }, error: null }) }),
      rpc: async () => ({ data: status, error: null }) }) },
    "next/navigation": { redirect: path => { throw new Error("redirect:" + path); } },
  };
  const auth = load("lib/auth/context.ts", mocks);
  assert.equal((await auth.getStaffContext()).profile.role, "platform_owner");
  await assert.rejects(() => auth.getClinicContext(), /redirect:\/auth\/access/);
  status = "active";
  assert.equal((await auth.getClinicContext()).profile.organization_id, uuid);
  const calls = [];
  const actions = load("actions/platform.ts", {
    "@/lib/platform/context": { getPlatformContext: async () => ({ profile: { role: "platform_owner" }, supabase: { rpc: async (...args) => { calls.push(args); return { error: null }; } } }) },
    "next/cache": { revalidatePath() {} },
  });
  const form = new FormData();
  form.set("clinic_id", uuid); form.set("status", "suspended"); form.set("expected", "active"); form.set("reason", "security_review");
  form.set("actor_id", "forged");
  assert.equal(Boolean((await actions.setClinicStatus(form)).success), true);
  assert.equal("p_actor_id" in calls[0][1], false);
  assert.equal(calls[0][1].p_expected, "active");
  const queries = load("lib/platform/queries.ts", { "@/lib/platform/context": { getPlatformContext: async () => ({ supabase: { rpc: async () => ({ data: [], error: null }) } }) } });
  await assert.rejects(() => queries.getPlatformOrganizations("tampered"));
  assert.equal((await queries.getPlatformOrganizations("")).rows.length, 0);
  console.log("PASS: owner-only capabilities, validated status reasons, separate staff/clinic contexts, suspension denial, actor-free stale-safe action and strict global directory cursor.");
})().catch(error => { console.error(error); process.exitCode = 1; });
