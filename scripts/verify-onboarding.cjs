/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");

const actorId = "11111111-1111-4111-8111-111111111111";
const clinicId = "22222222-2222-4222-8222-222222222222";
const foreignClinic = "33333333-3333-4333-8333-333333333333";
const token = "a".repeat(64);
const { can } = load("lib/auth/permissions.ts");
const { staffInviteSchema, clinicProvisionSchema, invitationTokenSchema } = load("lib/validations/onboarding.ts");
assert.equal(can("organization_admin", "clinics:create"), false);
assert.equal(can("platform_owner", "clinics:create"), true);
assert.equal(can("doctor", "team:manage"), false);
assert.equal(staffInviteSchema.safeParse({ email: "test@example.invalid", full_name: "Test", role: "platform_owner" }).success, false);
assert.equal(clinicProvisionSchema.safeParse({ name: "Test", slug: "invalid slug", admin_email: "test@example.invalid", admin_name: "Test" }).success, false);
assert.equal(invitationTokenSchema.safeParse("short").success, false);

async function verify() {
  let role = "organization_admin";
  let failed = false;
  const calls = [];
  const refreshed = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }) },
    rpc: async (name, parameters) => {
      calls.push({ name, parameters });
      return { data: { token, invitation_id: actorId, organization_id: clinicId }, error: failed ? { message: "private detail" } : null };
    },
  };
  const mocks = {
    "@/lib/auth/context": { getClinicContext: async () => ({ supabase: client, user: { id: actorId }, profile: { role, organization_id: clinicId } }) },
    "@/lib/supabase/server": { createClient: async () => client },
    "next/cache": { revalidatePath: path => refreshed.push(path) },
  };
  const { inviteStaff, setStaffActivity } = load("actions/staff.ts", mocks);
  const { provisionClinic, updateClinicProfile } = load("actions/clinic.ts", mocks);
  const { acceptInvitation } = load("actions/invitation.ts", mocks);
  function form(values) {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  }
  const result = await inviteStaff(form({ email: "test@example.invalid", full_name: "Synthetic", role: "doctor", clinic_id: foreignClinic, invited_by: "forged" }));
  assert.equal(result.invitationPath, `/auth/invitation#token=${token}`);
  assert.equal(calls[0].parameters.p_clinic, clinicId);
  assert.equal("p_invited_by" in calls[0].parameters, false);
  role = "platform_owner";
  await inviteStaff(form({ email: "test@example.invalid", full_name: "Synthetic", role: "nurse", clinic_id: foreignClinic }));
  assert.equal(calls[1].parameters.p_clinic, foreignClinic);
  role = "doctor";
  await assert.rejects(() => inviteStaff(form({})), /Administration permission/);
  role = "platform_owner";
  await provisionClinic(form({ name: "Test", slug: "test-clinic", admin_email: "test@example.invalid", admin_name: "Test" }));
  await updateClinicProfile(form({ name: "Test", email: "", phone: "", address: "", clinic_id: foreignClinic }));
  assert.equal(calls.at(-1).parameters.p_clinic, clinicId);
  await setStaffActivity(form({ staff_id: actorId, active: "false", role: "platform_owner" }));
  assert.equal("p_role" in calls.at(-1).parameters, false);
  await acceptInvitation(form({ token, role: "platform_owner", organization_id: foreignClinic }));
  assert.equal(JSON.stringify(calls.at(-1).parameters), JSON.stringify({ p_token: token }));
  failed = true;
  const failure = await inviteStaff(form({ email: "test@example.invalid", full_name: "Synthetic", role: "nurse" }));
  assert.equal(Boolean(failure.error), true);
  assert.equal(JSON.stringify(failure).includes("private detail"), false);
  assert.equal(refreshed.includes("/dashboard/team"), true);

  const uiMocks = {
    "next/link": ({ href, children }) => React.createElement("a", { href }, children),
    "@/components/shared/action-form": ({ children }) => React.createElement("form", null, children),
    "@/components/onboarding/administration-form": ({ children }) => React.createElement("form", null, children),
    "@/components/onboarding/staff-role-form": () => null,
    "@/actions/staff": { inviteStaff() {}, setStaffActivity() {} },
  };
  const InviteForm = load("components/onboarding/invite-form.tsx", uiMocks).default;
  const inviteMarkup = renderToStaticMarkup(React.createElement(InviteForm, { clinicId }));
  assert.equal(inviteMarkup.includes("Platform Owner"), false);
  assert.equal(inviteMarkup.includes(`id="${clinicId}-invite-email"`), true);
  const StaffActivity = load("components/onboarding/staff-activity.tsx", uiMocks).default;
  const staff = [
    { id: actorId, full_name: "Self", role: "organization_admin", email: "self@example.invalid", is_active: true, phone: null },
    { id: clinicId, full_name: "Owner", role: "platform_owner", email: "owner@example.invalid", is_active: true, phone: null },
    { id: foreignClinic, full_name: "Synthetic", role: "doctor", email: "staff@example.invalid", is_active: false, phone: null },
  ];
  const staffMarkup = renderToStaticMarkup(React.createElement(StaffActivity, { staff, actorId }));
  assert.equal(staffMarkup.includes("Reactivate"), true);
  assert.equal((staffMarkup.match(/name="staff_id"/g) ?? []).length, 1);
  assert.equal(staffMarkup.includes("lg:grid-cols-2"), true);
  const exchanged = [];
  const { GET } = load("app/auth/callback/route.ts", {
    "next/server": { NextResponse: { redirect: url => ({ url: url.href, headers: new Map() }) } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { exchangeCodeForSession: async code => { exchanged.push(code); return { error: null }; } } }) },
  });
  const callback = await GET({ nextUrl: new URL("https://clinic.example/auth/callback?code=synthetic-code&next=https://attacker.example"), url: "https://clinic.example/auth/callback?code=synthetic-code" });
  assert.equal(exchanged[0], "synthetic-code");
  assert.equal(callback.url, "https://clinic.example/auth/invitation");
  assert.equal(callback.headers.get("Cache-Control"), "private, no-store");
  console.log("PASS: administration capabilities, validated clinic/role/token input, server clinic derivation, owner target authorization, no forged actor/acceptance roles, safe failures, secret fragment link, unique labels and protected staff controls.");
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
