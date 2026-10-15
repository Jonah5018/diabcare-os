/* eslint-disable @typescript-eslint/no-require-imports -- Shared workspace regression without a new UI dependency. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");

const { navigationForRole, workflowActions, workspaceGuidance } = load("lib/workspace/navigation.ts");
const { roleLabels } = load("lib/auth/permissions.ts");
for (const role of Object.keys(roleLabels)) {
  const hrefs = navigationForRole(role).map(item => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(hrefs.includes("/dashboard/patients"), true);
  assert.equal(hrefs.includes("/dashboard/appointments"), true);
  assert.equal(hrefs.includes("/dashboard/settings"), true);
  assert.equal(Boolean(workspaceGuidance[role].description), true);
  assert.equal(workflowActions(role).length >= 2, true);
  if (!["organization_admin", "platform_owner"].includes(role)) {
    for (const target of ["team", "audit", "billing", "clinics"]) assert.equal(hrefs.includes(`/dashboard/${target}`), false);
  }
  assert.equal(hrefs.includes("/platform"), role === "platform_owner");
  assert.equal(hrefs.includes("/dashboard/reports"), ["doctor", "organization_admin", "platform_owner"].includes(role));
}
assert.equal(workflowActions("receptionist").some(action => action.href === "/dashboard/patients/new"), true);
assert.equal(workflowActions("nurse").some(action => /vitals/.test(action.title)), true);
assert.equal(workflowActions("lab_scientist").some(action => action.href === "/dashboard/laboratory"), true);

async function verify() {
  const today = "2026-10-15";
  const rows = {
    patients: [{ organization_id: "a" }, { organization_id: "b" }],
    appointments: [
      { organization_id: "a", appointment_date: today, status: "waiting" },
      { organization_id: "a", appointment_date: today, status: "completed" },
      { organization_id: "a", appointment_date: today, status: "cancelled" },
      { organization_id: "a", appointment_date: "2026-10-16", status: "waiting" },
      { organization_id: "b", appointment_date: today, status: "waiting" },
    ],
    follow_ups: [
      { organization_id: "a", due_date: "2026-10-14", status: "planned" },
      { organization_id: "a", due_date: today, status: "planned" },
      { organization_id: "a", due_date: "2026-10-14", status: "completed" },
      { organization_id: "b", due_date: "2026-10-14", status: "planned" },
    ],
  };
  let unavailable = false;
  const calls = [];
  const supabase = {
    from(table) {
      const filters = [];
      const call = { table, clinic: null, head: false };
      calls.push(call);
      const query = {
        select(columns, options) { assert.equal(columns, "id"); call.head = options.head; return query; },
        eq(column, value) { if (column === "organization_id") call.clinic = value; filters.push(row => row[column] === value); return query; },
        neq(column, value) { filters.push(row => row[column] !== value); return query; },
        lt(column, value) { filters.push(row => row[column] < value); return query; },
        then(resolve) { return Promise.resolve({ count: unavailable ? null : rows[table].filter(row => filters.every(filter => filter(row))).length, error: null }).then(resolve); },
      };
      return query;
    },
  };
  const { getWorkspaceOverview } = load("lib/workspace/overview.ts", {
    "@/lib/auth/context": { getClinicContext: async () => ({ supabase, profile: { organization_id: "a" } }) },
    "@/lib/clinic-date": { getClinicToday: () => today },
  });
  const overview = await getWorkspaceOverview();
  assert.equal(overview.patients, 1);
  assert.equal(overview.appointments, 2);
  assert.equal(overview.waiting, 1);
  assert.equal(overview.overdueFollowUps, 1);
  assert.equal(calls.every(call => call.clinic === "a" && call.head), true);
  unavailable = true;
  await assert.rejects(() => getWorkspaceOverview(), /Unable to load/);

  const link = ({ href, children, ...props }) => {
    delete props.onNavigate;
    return React.createElement("a", { href, ...props }, children);
  };
  const uiMocks = { "next/link": link };
  const EmptyState = load("components/shared/empty-state.tsx", uiMocks).default;
  const emptyAction = renderToStaticMarkup(React.createElement(EmptyState, { title: "No records", description: "Synthetic", href: "/dashboard/patients", label: "Find a patient" }));
  assert.match(emptyAction, /href="\/dashboard\/patients"/);
  assert.match(emptyAction, /Find a patient/);
  const PatientRow = load("components/patients/patient-row.tsx", uiMocks).default;
  const PatientTable = load("components/patients/patient-table.tsx", {
    ...uiMocks,
    "./patient-row": PatientRow,
    "@/components/shared/empty-state": EmptyState,
  }).default;
  const empty = renderToStaticMarkup(React.createElement(PatientTable, { patients: [], search: "Synthetic" }));
  assert.match(empty, /No matching patients/);
  assert.match(empty, /role="status"/);
  assert.match(empty, /type="search"/);
  assert.match(empty, /text-base/);
  const patient = { id: "synthetic", hospital_number: "TEST", first_name: "<script>test</script>", last_name: "Synthetic", other_names: null, gender: "female", phone: "000" };
  const directory = renderToStaticMarkup(React.createElement(PatientTable, { patients: [patient] }));
  assert.equal(directory.includes("<script>test</script>"), false);
  assert.match(directory, /scope="col"/);
  assert.match(directory, /md:hidden/);

  const Sidebar = load("components/dashboard/sidebar.tsx", {
    ...uiMocks,
    "next/navigation": { usePathname: () => "/dashboard/patients/synthetic" },
    "@/actions/auth": { signOut() {} },
  }).default;
  const account = { role: "receptionist", clinicName: "Synthetic Clinic", fullName: "Test Staff" };
  const navigation = renderToStaticMarkup(React.createElement(Sidebar, { account }));
  assert.match(navigation, /aria-current="page"/);
  assert.match(navigation, /Care workspace/);
  assert.equal(navigation.includes('href="/platform"'), false);
  assert.equal(navigation.includes('href="/dashboard/team"'), false);

  const Topbar = load("components/dashboard/topbar.tsx", uiMocks).default;
  const topbar = renderToStaticMarkup(React.createElement(Topbar, { account, onMenu() {} }));
  assert.match(topbar, /aria-label="Open navigation menu"/);
  assert.match(topbar, /aria-controls="clinic-navigation-drawer"/);
  assert.match(topbar, /aria-expanded="false"/);

  const Loading = load("app/dashboard/loading.tsx").default;
  assert.match(renderToStaticMarkup(React.createElement(Loading)), /motion-safe:animate-pulse/);
  const Status = load("components/appointments/appointment-status.tsx").default;
  assert.match(renderToStaticMarkup(React.createElement(Status, { status: "in_consultation" })), /In Consultation/);
  const ErrorPage = load("app/dashboard/error.tsx", uiMocks).default;
  const failure = renderToStaticMarkup(React.createElement(ErrorPage, { error: new Error("PRIVATE_DETAIL"), reset() {} }));
  assert.equal(failure.includes("PRIVATE_DETAIL"), false);
  assert.match(failure, /role="alert"/);
  console.log("PASS: role-coherent navigation/actions, real scoped day/queue/overdue count semantics, unavailable-count denial, escaped responsive directory, explicit status labels, menu accessibility, reduced-motion loading and safe error feedback.");
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
