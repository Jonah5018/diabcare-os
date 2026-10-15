/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");

const actorId = "11111111-1111-4111-8111-111111111111";
const staffId = "22222222-2222-4222-8222-222222222222";
const { can, permissionLabels, roleLabels } = load("lib/auth/permissions.ts");
const { staffRoleSchema } = load("lib/validations/staff-role.ts");
assert.equal(can("organization_admin", "team:roles"), true);
assert.equal(can("platform_owner", "team:roles"), true);
for (const role of ["doctor", "nurse", "receptionist", "lab_scientist"]) {
  assert.equal(can(role, "team:roles"), false);
}
const values = { staff_id: staffId, role: "nurse", expected_role: "doctor" };
assert.equal(staffRoleSchema.safeParse(values).success, true);
for (const change of [{ staff_id: "invalid" }, { role: "platform_owner" }, { expected_role: "invalid" }]) {
  assert.equal(staffRoleSchema.safeParse({ ...values, ...change }).success, false);
}

async function verify() {
  let role = "organization_admin";
  let failure = "none";
  const commands = [];
  const refreshed = [];
  const { changeStaffRole } = load("actions/staff-role.ts", {
    "@/lib/auth/context": { getClinicContext: async () => ({
      profile: { role, organization_id: "derived-clinic" },
      user: { id: actorId },
      supabase: { rpc: async (name, parameters) => {
        commands.push({ name, parameters });
        if (failure === "throw") throw new Error("private database detail");
        return { data: staffId, error: failure === "return" ? { message: "private database detail" } : null };
      } },
    }) },
    "next/cache": { revalidatePath: path => refreshed.push(path) },
  });
  function form(change = {}) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ ...values, organization_id: "forged", actor_id: "forged", ...change })) {
      data.set(key, value);
    }
    return data;
  }
  assert.equal(Boolean((await changeStaffRole(form())).success), true);
  assert.equal(commands[0].name, "change_staff_role");
  assert.equal(commands[0].parameters.p_expected_role, "doctor");
  assert.equal(JSON.stringify(Object.keys(commands[0].parameters).sort()), JSON.stringify(["p_expected_role", "p_role", "p_staff_id"]));
  assert.equal(refreshed.includes("/dashboard/team"), true);
  assert.equal(refreshed.includes("/dashboard/audit"), true);
  assert.equal(Boolean((await changeStaffRole(form({ staff_id: actorId }))).error), true);
  assert.equal(Boolean((await changeStaffRole(form({ role: "platform_owner" }))).error), true);
  assert.equal(commands.length, 1);
  role = "doctor";
  await assert.rejects(() => changeStaffRole(form()), /Administration permission/);
  assert.equal(commands.length, 1);
  role = "organization_admin";
  for (const mode of ["return", "throw"]) {
    failure = mode;
    const result = await changeStaffRole(form());
    assert.equal(Boolean(result.error), true);
    assert.equal(JSON.stringify(result).includes("private database detail"), false);
  }

  const mocks = {
    "@/actions/staff-role": { changeStaffRole() {} },
    "@/actions/staff": { setStaffActivity() {} },
    "@/components/shared/action-form": ({ children }) => React.createElement("form", null, children),
  };
  const StaffRoleForm = load("components/onboarding/staff-role-form.tsx", mocks).default;
  mocks["@/components/onboarding/staff-role-form"] = StaffRoleForm;
  const formMarkup = renderToStaticMarkup(React.createElement(StaffRoleForm, { staffId, role: "doctor" }));
  assert.equal(formMarkup.includes(`for="staff-role-${staffId}"`), true);
  assert.equal(formMarkup.includes(`id="staff-role-${staffId}"`), true);
  assert.equal(formMarkup.includes('name="expected_role" value="doctor"'), true);
  assert.equal(formMarkup.includes('value="platform_owner"'), false);
  assert.equal(renderToStaticMarkup(React.createElement(StaffRoleForm, { staffId, role: "platform_owner" })), "");
  const StaffActivity = load("components/onboarding/staff-activity.tsx", mocks).default;
  const staff = [
    { id: actorId, role: "organization_admin", full_name: "Self", email: "self@example.invalid", phone: null, is_active: true },
    { id: "33333333-3333-4333-8333-333333333333", role: "platform_owner", full_name: "Owner", email: "owner@example.invalid", phone: null, is_active: true },
    { id: staffId, role: "doctor", full_name: "Synthetic", email: "staff@example.invalid", phone: null, is_active: false },
  ];
  const staffMarkup = renderToStaticMarkup(React.createElement(StaffActivity, { staff, actorId, canChangeRoles: true }));
  assert.equal((staffMarkup.match(/Save role/g) ?? []).length, 1);
  assert.equal(staffMarkup.includes("Reactivate"), true);
  assert.equal(renderToStaticMarkup(React.createElement(StaffActivity, { staff, actorId, canChangeRoles: false })).includes("Save role"), false);

  const PermissionMatrix = load("components/onboarding/permission-matrix.tsx").default;
  const matrix = renderToStaticMarkup(React.createElement(PermissionMatrix));
  assert.equal(matrix.includes("overflow-x-auto"), true);
  assert.equal(matrix.includes('scope="row"'), true);
  assert.equal(matrix.includes(permissionLabels["team:roles"]), true);
  for (const label of Object.values(roleLabels)) assert.equal(matrix.includes(label), true);

  const AuditMetadata = load("components/audit/audit-details.tsx").default;
  const audit = renderToStaticMarkup(React.createElement(AuditMetadata, {
    details: { role: "nurse", previous_role: "doctor", is_active: false, previous_is_active: true, ignored_secret: "must-not-render" },
  }));
  assert.equal(audit.includes("Doctor → Nurse"), true);
  assert.equal(audit.includes("Active → Inactive"), true);
  assert.equal(audit.includes("must-not-render"), false);
  const legacyAudit = renderToStaticMarkup(React.createElement(AuditMetadata, {
    details: { status: "completed", previous_status: "in_consultation" },
  }));
  assert.equal(legacyAudit.includes("in consultation → completed"), true);
  console.log("PASS: role capabilities/validation, protected self and owner UI, server identity boundaries, safe errors, revalidation, stale-role payload, accessible role forms/matrix, and privacy-preserving before/after audit rendering.");
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
