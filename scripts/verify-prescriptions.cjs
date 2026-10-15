/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const { load } = require("./source-loader.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { can } = load("lib/auth/permissions.ts");
const { prescriptionSchema } = load("lib/validations/prescription.ts");
const patientId = "11111111-1111-4111-8111-111111111111";
const consultationId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const item = {
  medication_name: "Synthetic medication",
  strength: "Test strength",
  dose: "Test dose",
  frequency: "Test frequency",
  route: "",
  duration: "Test duration",
  instructions: "",
};
const values = {
  patient_id: patientId,
  consultation_id: consultationId,
  request_id: requestId,
  prescribed_date: "2026-01-01",
  items: [item],
};

for (const role of ["doctor", "organization_admin", "platform_owner"]) {
  assert.equal(can(role, "prescriptions:create"), true);
}
for (const role of ["nurse", "receptionist", "lab_scientist"]) {
  assert.equal(can(role, "prescriptions:create"), false);
  assert.equal(can(role, "prescriptions:update"), false);
}

assert.equal(prescriptionSchema.safeParse(values).success, true);
assert.equal(prescriptionSchema.safeParse({ ...values, items: [] }).success, false);
assert.equal(prescriptionSchema.safeParse({ ...values, items: Array(21).fill(item) }).success, false);
assert.equal(prescriptionSchema.safeParse({ ...values, items: [{ ...item, dose: " " }] }).success, false);
assert.equal(prescriptionSchema.safeParse({ ...values, items: [{ ...item, instructions: "x".repeat(2001) }] }).success, false);
assert.equal(prescriptionSchema.safeParse({ ...values, prescribed_date: "2099-01-01" }).success, false);
assert.equal(prescriptionSchema.safeParse({ ...values, prescribed_date: "2026-02-30" }).success, false);
assert.equal(prescriptionSchema.safeParse({ ...values, consultation_id: "bad-id" }).success, false);

// Render the actual components with synthetic DTOs; never write live UI fixtures.
const uiMocks = {
  "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
  "@/actions/prescription": {
    createPrescription: async () => ({}),
    transitionPrescription: async () => ({}),
  },
};
uiMocks["@/components/prescriptions/medication-fields"] = load(
  "components/prescriptions/medication-fields.tsx", uiMocks
);
uiMocks["@/components/shared/action-form"] = load("components/shared/action-form.tsx", uiMocks);
const PrescriptionForm = load("components/prescriptions/prescription-form.tsx", uiMocks).default;
const PrescriptionHistory = load("components/prescriptions/prescription-history.tsx", uiMocks).default;
const formMarkup = renderToStaticMarkup(React.createElement(PrescriptionForm, {
  patientId, consultationId, today: "2026-01-01",
}));
assert.equal(formMarkup.includes("Medication name"), true);
assert.equal(formMarkup.includes("Add medication"), true);
assert.equal(formMarkup.includes("items.0.duration"), true);
assert.equal(formMarkup.includes("sm:grid-cols-2"), true);
assert.equal(new Set([...formMarkup.matchAll(/ id="([^"]+)"/g)].map(match => match[1])).size, 8);

const historyRow = {
  id: requestId, prescriber_id: "actor", consultation_id: consultationId,
  status: "active", prescribed_date: "2026-01-01", prescriber: { full_name: "Synthetic prescriber" },
  items: [{ ...item, id: "item", position: 1 }],
};
const historyMarkup = props => renderToStaticMarkup(React.createElement(PrescriptionHistory, {
  rows: [historyRow], userId: "actor", administrator: false, canUpdate: true, ...props,
}));
assert.equal(historyMarkup({}).includes("Save status"), true);
assert.equal(historyMarkup({ userId: "other-doctor" }).includes("Save status"), false);
assert.equal(historyMarkup({ userId: "admin", administrator: true }).includes("Save status"), true);
assert.equal(historyMarkup({ rows: [{ ...historyRow, status: "cancelled" }] }).includes("Save status"), false);
assert.equal(historyMarkup({ rows: [] }).includes("No prescriptions recorded"), true);

function form(input = values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(input)) {
    data.set(key, key === "items" ? JSON.stringify(value) : value);
  }
  return data;
}

async function verifyActions() {
  let role = "doctor";
  let databaseError = null;
  let transportFails = false;
  const calls = [];
  const revalidated = [];
  const mocks = {
    "@/lib/auth/context": {
      getClinicContext: async () => ({
        profile: { role, organization_id: "trusted-clinic" },
        user: { id: "trusted-actor" },
        supabase: {
          rpc: async (name, arguments_) => {
            if (transportFails) throw new Error("Sensitive transport detail");
            calls.push({ name, arguments_ });
            return { data: requestId, error: databaseError };
          },
        },
      }),
    },
    "next/cache": { revalidatePath: path => revalidated.push(path) },
  };
  const { createPrescription, transitionPrescription } = load("actions/prescription.ts", mocks);

  const forgedForm = form();
  forgedForm.set("organization_id", "forged-clinic");
  forgedForm.set("prescriber_id", "forged-actor");
  assert.equal(Boolean((await createPrescription({}, forgedForm)).success), true);
  assert.equal(calls[0].name, "create_prescription");
  assert.equal(Object.hasOwn(calls[0].arguments_, "organization_id"), false);
  assert.equal(Object.hasOwn(calls[0].arguments_, "prescriber_id"), false);
  assert.equal(calls[0].arguments_.p_request_id, requestId);
  assert.equal(calls[0].arguments_.p_items[0].medication_name, item.medication_name);
  assert.equal(revalidated.includes(`/dashboard/patients/${patientId}`), true);

  const malformed = form();
  malformed.set("items", "invalid json");
  assert.equal(Boolean((await createPrescription({}, malformed)).error), true);
  assert.equal(calls.length, 1);

  role = "receptionist";
  assert.equal(Boolean((await createPrescription({}, form())).error), true);
  assert.equal(calls.length, 1);

  role = "doctor";
  const transition = new FormData();
  transition.set("prescription_id", requestId);
  transition.set("status", "active");
  assert.equal(Boolean((await transitionPrescription(transition)).error), true);
  assert.equal(calls.length, 1);
  transition.set("status", "cancelled");
  assert.equal(Boolean((await transitionPrescription(transition)).success), true);
  assert.equal(calls[1].name, "transition_prescription");

  databaseError = { message: "Sensitive medication detail", code: "42501" };
  const denied = await createPrescription({}, form());
  assert.equal(Boolean(denied.error), true);
  assert.equal(denied.error.includes("Sensitive"), false);

  transportFails = true;
  const failedCreate = await createPrescription({}, form());
  const failedTransition = await transitionPrescription(transition);
  assert.equal(Boolean(failedCreate.error), true);
  assert.equal(Boolean(failedTransition.error), true);
  assert.equal(JSON.stringify([failedCreate, failedTransition]).includes("Sensitive"), false);

  const historyCalls = [];
  const historyRows = Array.from({ length: 26 }, (_, index) => ({ ...historyRow, id: String(index) }));
  const historyQuery = {
    select(fields) { historyCalls.push(["select", fields]); return historyQuery; },
    eq(key, value) { historyCalls.push([key, value]); return historyQuery; },
    order(key, options) { historyCalls.push(["order", key, options]); return historyQuery; },
    limit(value) { historyCalls.push(["limit", value]); return historyQuery; },
    or(value) { historyCalls.push(["cursor", value]); return historyQuery; },
    then(resolve) { return Promise.resolve({ data: historyRows, error: null }).then(resolve); },
  };
  const { getPrescriptionHistory } = load("lib/prescriptions/history.ts", {
    "@/lib/auth/context": {
      getClinicContext: async () => ({
        profile: { organization_id: "trusted-clinic" },
        supabase: { from: () => historyQuery },
      }),
    },
  });
  const { encodeCursor } = load("lib/pagination.ts");
  const history = await getPrescriptionHistory(patientId, encodeCursor({
    id: requestId, created_at: "2026-01-01T00:00:00Z",
  }));
  assert.equal(history.rows.length, 25);
  assert.equal(history.hasMore, true);
  assert.equal(historyCalls.some(([key, value]) => key === "organization_id" && value === "trusted-clinic"), true);
  assert.equal(historyCalls.some(([key, value]) => key === "patient_id" && value === patientId), true);
  assert.equal(historyCalls.some(([key, value]) => key === "limit" && value === 26), true);
  assert.equal(historyCalls.some(([key]) => key === "cursor"), true);
  historyCalls.length = 0;
  await getPrescriptionHistory(patientId, "tampered");
  assert.equal(historyCalls.some(([key]) => key === "cursor"), false);

  console.log("PASS: prescription capabilities, structured validation, bounded items, date checks, forged actor/clinic rejection, safe RPC errors, terminal action validation and cache refresh.");
}

verifyActions().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
