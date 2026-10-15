/* eslint-disable @typescript-eslint/no-require-imports -- Existing standalone source verification harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");

const { can, roleLabels } = load("lib/auth/permissions.ts");
const { measurementTrend, isOverduePlan } = load("lib/clinical-review/trends.ts");
const schemas = load("lib/validations/clinical-review.ts");
const id = index => `70000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const patient = id(1);
const clinic = id(2);
const today = "2026-10-15";
const time = day => `2026-10-${String(day).padStart(2, "0")}T12:00:00+00:00`;

for (const role of Object.keys(roleLabels)) {
  assert.equal(can(role, "clinical-review:view"), ["doctor", "organization_admin", "platform_owner"].includes(role));
}

const point = (sourceId, recordedAt, value) => ({ sourceId, recordedAt, value });
const trend = measurementTrend([
  point(id(13), time(15), 8.23),
  point(id(11), time(1), 0),
  point(id(12), time(2), 6.1),
  point(id(14), null, 10),
  point(id(15), time(3), null),
]);
assert.equal(trend.points[0].value, 0);
assert.equal(trend.points.at(-1).sourceId, id(13));
assert.equal(trend.change, 2.13);
assert.equal(trend.omitted, 2);
assert.match(trend.coordinates, /^12\.00,76\.00 30\.29,/);
assert.equal(measurementTrend([]).coordinates, null);
assert.equal(measurementTrend([point(id(1), time(1), 5)]).change, null);
assert.equal(measurementTrend([point(id(1), time(1), 5)]).coordinates, "140.00,52.00");
assert.equal(measurementTrend([point(id(1), "invalid", 5)]).points.length, 0);
assert.equal(measurementTrend([point(id(1), time(1), Infinity)]).points.length, 0);
assert.equal(measurementTrend([point(id(1), time(1), -1e308), point(id(2), time(2), 1e308)]).coordinates, null);
assert.equal(measurementTrend([point(id(1), time(1), -1e308), point(id(2), time(2), 1e308)]).change, null);
assert.throws(() => measurementTrend(Array(13).fill(point(id(1), time(1), 1))), /bounded/);
const tied = measurementTrend([point(id(3), time(2), 3), point(id(2), time(2), 2)]);
assert.equal(tied.points[0].sourceId, id(2));
assert.equal(isOverduePlan({ status: "planned", due_date: "2026-10-14" }, today), true);
assert.equal(isOverduePlan({ status: "planned", due_date: today }, today), false);
assert.equal(isOverduePlan({ status: "completed", due_date: "2026-10-14" }, today), false);
assert.equal(schemas.reviewLabSchema.safeParse({ id: id(1), created_at: null, hba1c: null, creatinine: null }).success, true);

async function verify() {
  let role = "doctor";
  let mode = "normal";
  let calls = [];
  const record = index => ({ id: id(100 + index), created_at: time(15 - index) });
  const datasets = {
    vitals: Array.from({ length: 13 }, (_, index) => ({
      ...record(index), weight: index === 0 ? null : 60 + index,
      created_at: index === 0 ? null : time(15 - index),
      systolic_bp: null, diastolic_bp: null, fasting_blood_sugar: 5.1,
      random_blood_sugar: null, private_unused_field: "DO_NOT_RENDER",
    })),
    laboratory_results: Array.from({ length: 13 }, (_, index) => ({ ...record(index), hba1c: index === 0 ? null : 6 + index / 10, creatinine: 88 })),
    consultations: Array.from({ length: 4 }, (_, index) => ({
      ...record(index), visit_date: null, diagnosis: null, chief_complaint: `<script>synthetic</script>${"x".repeat(250)}`,
    })),
    appointments: Array.from({ length: 6 }, (_, index) => ({ id: id(200 + index), appointment_date: today, status: "completed" })),
    prescriptions: Array.from({ length: 6 }, (_, index) => ({
      id: id(300 + index), prescribed_date: today, status: "active",
      items: [{ id: id(400 + index), position: 1, medication_name: "Synthetic item", strength: "Test", dose: "Test", frequency: "Test" }],
    })),
    follow_ups: Array.from({ length: 6 }, (_, index) => ({ id: id(500 + index), due_date: "2026-10-14", status: "planned", reason: "Synthetic plan" })),
  };
  const supabase = {
    from(table) {
      const call = { table, filters: [], orders: [], limit: null };
      calls.push(call);
      const result = () => {
        if (mode === "thrown") throw new Error("PRIVATE_PROVIDER_DETAIL");
        if (mode === "error") return { error: { message: "PRIVATE_PROVIDER_DETAIL" }, data: null };
        if (table === "patients") return {
          error: null,
          data: mode === "foreign" ? null : { id: patient, first_name: "Synthetic", last_name: "Patient", hospital_number: "TEST-REVIEW" },
        };
        const data = mode === "empty" ? [] : datasets[table];
        return { error: null, data: mode === "invalid" && table === "vitals" ? [{ ...data[0], weight: "PRIVATE_VALUE" }] : data };
      };
      const query = {
        select(selection) { call.selection = selection; return query; },
        eq(column, value) { call.filters.push(["eq", column, value]); return query; },
        lte(column, value) { call.filters.push(["lte", column, value]); return query; },
        order(column, options) { call.orders.push([column, options]); return query; },
        limit(value) { call.limit = value; return query; },
        maybeSingle() { return query; },
        then(resolve, reject) { return Promise.resolve().then(result).then(resolve, reject); },
      };
      return query;
    },
  };
  const { getClinicalReview } = load("lib/clinical-review/queries.ts", {
    "@/lib/auth/context": {
      requirePermission: async permission => {
        assert.equal(permission, "clinical-review:view");
        if (!can(role, permission)) throw new Error("DENIED");
        return { supabase, profile: { organization_id: clinic } };
      },
    },
    "@/lib/clinic-date": { getClinicToday: () => today },
  });

  const review = await getClinicalReview(patient);
  assert.equal(calls.length, 7);
  assert.equal(review.vitals.rows.length, 12);
  assert.equal(review.vitals.hasMore, true);
  assert.equal(review.laboratories.rows.length, 12);
  assert.equal(review.consultations.rows.length, 3);
  assert.equal(review.appointments.rows.length, 5);
  assert.equal(review.prescriptions.rows.length, 5);
  assert.equal(review.followUps.rows.length, 5);
  assert.equal(review.vitals.rows[0].weight, null);
  assert.equal("private_unused_field" in review.vitals.rows[0], false);
  assert.equal(review.consultations.rows[0].chief_complaint.length, 200);
  assert.equal(review.consultations.rows[0].visit_date, null);
  const limits = { vitals: 13, laboratory_results: 13, consultations: 4, appointments: 6, prescriptions: 6, follow_ups: 6 };
  for (const call of calls) {
    assert.equal(call.filters.some(([operator, column, value]) => operator === "eq" && column === "organization_id" && value === clinic), true);
    if (call.table === "patients") continue;
    assert.equal(call.filters.some(([operator, column, value]) => operator === "eq" && column === "patient_id" && value === patient), true);
    assert.equal(call.limit, limits[call.table]);
    assert.equal(call.selection.includes("*"), false);
    assert.equal(call.orders.at(-1)[0], "id");
    assert.equal(call.orders[0][1].nullsFirst, false);
  }
  assert.equal(calls.find(call => call.table === "appointments").filters.some(filter => filter.join() === ["lte", "appointment_date", today].join()), true);
  assert.equal(calls.find(call => call.table === "prescriptions").filters.some(filter => filter.join() === "eq,status,active"), true);
  assert.equal(calls.find(call => call.table === "follow_ups").orders[0][1].ascending, true);
  assert.equal(calls.find(call => call.table === "follow_ups").filters.some(filter => filter.join() === "eq,status,planned"), true);

  for (role of ["nurse", "receptionist", "lab_scientist"]) {
    calls = [];
    await assert.rejects(() => getClinicalReview(patient), /DENIED/);
    assert.equal(calls.length, 0);
  }
  role = "doctor";
  for (mode of ["error", "thrown", "invalid"]) {
    await assert.rejects(() => getClinicalReview(patient), error => {
      assert.equal(error.message, "Unable to load the clinical review");
      return true;
    });
  }
  mode = "foreign";
  calls = [];
  assert.equal(await getClinicalReview(patient), null);
  assert.equal(calls.length, 1);
  await assert.rejects(() => getClinicalReview("not-a-uuid"));
  assert.equal(calls.length, 1);

  const link = ({ children, href, ...props }) => {
    delete props.prefetch;
    return React.createElement("a", { href, ...props }, children);
  };
  const mocks = { "next/link": link };
  const components = {
    "@/components/clinical-review/trend-card": load("components/clinical-review/trend-card.tsx").default,
    "@/components/clinical-review/measurement-history": load("components/clinical-review/measurement-history.tsx").default,
    "@/components/clinical-review/source-records": load("components/clinical-review/source-records.tsx", {
      ...mocks,
      "@/components/appointments/appointment-status": load("components/appointments/appointment-status.tsx").default,
    }).default,
    "@/components/clinical-review/planned-care": load("components/clinical-review/planned-care.tsx", mocks).default,
  };
  const ClinicalReview = load("components/clinical-review/clinical-review.tsx", components).default;
  const markup = renderToStaticMarkup(React.createElement(ClinicalReview, { review }));
  assert.match(markup, /Recorded fact/);
  assert.match(markup, /Calculated value/);
  assert.match(markup, /Rule-based flag: overdue plan/);
  assert.match(markup, /Clinician entry/);
  assert.match(markup, /percentage points/);
  assert.match(markup, /µmol\/L/);
  assert.match(markup, /Not recorded/);
  assert.match(markup, /Date not recorded/);
  assert.match(markup, /More consultation records exist/);
  assert.match(markup, /scope="col"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.equal(markup.includes("<script>synthetic</script>"), false);
  assert.equal(markup.includes("DO_NOT_RENDER"), false);
  assert.match(markup, new RegExp(patient));
  mode = "empty";
  const empty = await getClinicalReview(patient);
  assert.equal(empty.vitals.hasMore, false);
  const emptyMarkup = renderToStaticMarkup(React.createElement(ClinicalReview, { review: empty }));
  assert.match(emptyMarkup, /No dated weight values recorded/);
  assert.match(emptyMarkup, /No active prescriptions recorded/);

  let requested = 0;
  const page = load("app/dashboard/patients/[id]/review/page.tsx", {
    ...mocks,
    "next/navigation": { notFound() { throw new Error("NOT_FOUND"); } },
    "@/lib/auth/context": { getClinicContext: async () => ({ profile: { role } }) },
    "@/lib/clinical-review/queries": { getClinicalReview: async () => { requested++; return mode === "foreign" ? null : empty; } },
    "@/components/dashboard/page-header": () => null,
    "@/components/shared/access-denied": () => React.createElement("p", null, "Access denied"),
    "@/components/clinical-review/clinical-review": ClinicalReview,
  }).default;
  role = "receptionist";
  assert.match(renderToStaticMarkup(await page({ params: Promise.resolve({ id: patient }) })), /Access denied/);
  assert.equal(requested, 0);
  role = "doctor";
  await page({ params: Promise.resolve({ id: patient }) });
  assert.equal(requested, 1);
  mode = "foreign";
  await assert.rejects(() => page({ params: Promise.resolve({ id: patient }) }), /NOT_FOUND/);
  await assert.rejects(() => page({ params: Promise.resolve({ id: "invalid" }) }), /NOT_FOUND/);
  console.log("PASS: clinician capability, server clinic/patient filters, bounded lookahead/source validation, safe failures, date/value omissions, units/time-spaced arithmetic, planning rule, escaped traceable rendering and route denial.");
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
