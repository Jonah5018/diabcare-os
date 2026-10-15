/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const { load } = require("./source-loader.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const patientId = "11111111-1111-4111-8111-111111111111";
const visitId = "22222222-2222-4222-8222-222222222222";
const { consultationSchema } = load("lib/validations/clinical.ts");
assert.equal(consultationSchema.safeParse({
  patient_id: patientId, appointment_id: "bad-id", chief_complaint: "Synthetic", diagnosis: "Synthetic",
}).success, false);

async function verifyVisitActions() {
  let visitStatus = "waiting";
  let visitPatient = patientId;
  let role = "doctor";
  const writes = [];
  const filtersSeen = [];
  const database = {
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        async maybeSingle() {
          const row = table === "appointments"
            ? { id: visitId, patient_id: visitPatient, organization_id: "clinic", status: visitStatus }
            : { id: patientId, organization_id: "clinic" };
          filtersSeen.push({ table, filters });
          return { data: filters.every(([key, value]) => row[key] === value) ? row : null, error: null };
        },
        async insert(row) { writes.push({ table, row }); return { error: null }; },
      };
      return query;
    },
  };
  const mocks = {
    "@/lib/auth/context": {
      getClinicContext: async () => ({
        supabase: database, profile: { role, organization_id: "clinic" }, user: { id: "actor" },
      }),
    },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound() { throw new Error("not-found"); } },
  };
  const { createConsultation } = load("actions/consultation.ts", mocks);
  const { getPatientVisit } = load("lib/visits/context.ts", mocks);

  function form(appointment = visitId) {
    const data = new FormData();
    data.set("patient_id", patientId);
    data.set("appointment_id", appointment);
    data.set("chief_complaint", "Synthetic complaint");
    data.set("diagnosis", "Synthetic diagnosis");
    return data;
  }

  assert.equal(Boolean((await createConsultation(form())).success), true);
  assert.equal(writes[0].row.appointment_id, visitId);
  assert.equal(writes[0].row.organization_id, "clinic");
  assert.equal(filtersSeen.some(entry => entry.table === "appointments" && entry.filters.some(([key]) => key === "patient_id")), true);

  visitStatus = "cancelled";
  assert.equal(Boolean((await createConsultation(form())).error), true);
  assert.equal(writes.length, 1);
  visitStatus = "scheduled";
  assert.equal(Boolean((await createConsultation(form())).error), true);
  visitStatus = "completed";
  assert.equal(Boolean((await createConsultation(form())).success), true);
  assert.equal(writes.length, 2);

  visitPatient = "different-patient";
  assert.equal(Boolean((await createConsultation(form())).error), true);
  await assert.rejects(() => getPatientVisit(patientId, visitId), /not-found/);
  await assert.rejects(() => getPatientVisit(patientId, "bad-id"), /not-found/);
  assert.equal(await getPatientVisit(patientId, ""), null);

  assert.equal(Boolean((await createConsultation(form(""))).success), true);
  assert.equal(writes[2].row.appointment_id, null);
  role = "receptionist";
  assert.equal(Boolean((await createConsultation(form())).error), true);
  assert.equal(writes.length, 3);

  const uiMocks = {
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "@/lib/visits/context": { getVisitRecordCounts: async () => [1, 2, 3, 4] },
  };
  uiMocks["@/components/appointments/appointment-status"] = load(
    "components/appointments/appointment-status.tsx", uiMocks
  );
  const VisitSummary = load("components/visits/visit-summary.tsx", uiMocks).default;
  const markup = renderToStaticMarkup(await VisitSummary({
    patientId,
    visit: { id: visitId, status: "waiting", appointment_date: "2026-01-01", queue_number: 1 },
  }));
  assert.equal(markup.includes("Queue #1"), true);
  assert.equal(markup.includes("Prescriptions"), true);
  assert.equal(markup.includes("does not imply"), true);
  assert.equal(markup.includes("sm:grid-cols-2"), true);

  const countQueries = [];
  let countFailure = false;
  const { getVisitRecordCounts } = load("lib/visits/context.ts", {
    "@/lib/auth/context": {
      getClinicContext: async () => ({
        profile: { organization_id: "clinic" },
        supabase: {
          from(table) {
            const entry = { table, filters: [], selection: "" };
            countQueries.push(entry);
            const query = {
              select(fields, options) {
                entry.selection = fields;
                assert.equal(options.head, true);
                assert.equal(options.count, "exact");
                return query;
              },
              eq(key, value) { entry.filters.push([key, value]); return query; },
              then(resolve) {
                return Promise.resolve({ count: 3, error: countFailure ? { code: "test" } : null }).then(resolve);
              },
            };
            return query;
          },
        },
      }),
    },
  });
  assert.equal(JSON.stringify(await getVisitRecordCounts(patientId, visitId)), "[3,3,3,3]");
  assert.equal(countQueries.length, 4);
  for (const query of countQueries) {
    assert.equal(query.filters.some(([key, value]) => key === "organization_id" && value === "clinic"), true);
    assert.equal(query.filters.some(([key, value]) => key === "patient_id" && value === patientId), true);
    const visitFilter = query.table === "prescriptions" ? "consultation.appointment_id" : "appointment_id";
    assert.equal(query.filters.some(([key, value]) => key === visitFilter && value === visitId), true);
  }
  assert.equal(countQueries[3].selection.includes("!inner"), true);
  countFailure = true;
  assert.equal(await getVisitRecordCounts(patientId, visitId), null);

  console.log("PASS: visit-aware action validation, patient/clinic filters, cancelled/scheduled rejection, completed-visit documentation, legacy unlinked recording, capability checks and safe context lookup.");
}

verifyVisitActions().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
