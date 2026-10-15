/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");

const patientId = "11111111-1111-4111-8111-111111111111";
const planId = "22222222-2222-4222-8222-222222222222";
const clinicId = "33333333-3333-4333-8333-333333333333";
const today = "2026-10-14";
const { can } = load("lib/auth/permissions.ts");
for (const role of ["doctor", "organization_admin", "platform_owner"]) {
  assert.equal(can(role, "follow-ups:create"), true);
  assert.equal(can(role, "follow-ups:update"), true);
}
for (const role of ["receptionist", "nurse", "lab_scientist"]) {
  assert.equal(can(role, "follow-ups:create"), false);
  assert.equal(can(role, "follow-ups:update"), false);
}
const clockMock = { "@/lib/clinic-date": { getClinicToday: () => today } };
const { followUpSchema } = load("lib/validations/follow-up.ts", clockMock);
const values = { patient_id: patientId, consultation_id: "", due_date: today, reason: " Synthetic review ", request_id: planId };
assert.equal(followUpSchema.parse(values).consultation_id, null);
assert.equal(followUpSchema.parse(values).reason, "Synthetic review");
for (const change of [{ due_date: "2026-02-30" }, { due_date: "2026-10-13" }, { reason: " " }, { reason: "x".repeat(2001) }, { patient_id: "invalid" }, { consultation_id: "invalid" }]) {
  assert.equal(followUpSchema.safeParse({ ...values, ...change }).success, false);
}
const { encodeDueCursor, dueCursorFilter } = load("lib/follow-ups/pagination.ts");
assert.equal(dueCursorFilter(encodeDueCursor({ due_date: today, id: planId })), `due_date.gt.${today},and(due_date.eq.${today},id.gt.${planId})`);
assert.throws(() => dueCursorFilter("!injection"), /Invalid follow-up cursor/);
assert.throws(() => dueCursorFilter(Buffer.from(JSON.stringify({ date: today, id: "bad,or.role.eq.owner" })).toString("base64url")));

async function verify() {
  let role = "doctor";
  let failure = "none";
  const commands = [];
  const refreshed = [];
  const mocks = {
    ...clockMock,
    "@/lib/auth/context": { getClinicContext: async () => ({
      profile: { role, organization_id: clinicId }, user: { id: planId },
      supabase: { rpc: async (name, parameters) => {
        commands.push({ name, parameters });
        if (failure === "throw") throw new Error("Sensitive reason");
        return { error: failure === "return" ? { message: "Sensitive reason" } : null };
      } },
    }) },
    "next/cache": { revalidatePath: path => refreshed.push(path) },
  };
  const { createFollowUp, transitionFollowUp } = load("actions/follow-up.ts", mocks);
  function form(change = {}) {
    const data = new FormData();
    Object.entries({ ...values, organization_id: "forged", created_by: "forged", ...change }).forEach(([key, value]) => data.set(key, value));
    return data;
  }
  assert.equal(Boolean((await createFollowUp({}, form())).success), true);
  assert.equal(commands[0].parameters.p_patient_id, patientId);
  assert.equal(commands[0].parameters.p_consultation_id, null);
  assert.equal("p_organization_id" in commands[0].parameters, false);
  assert.equal("p_created_by" in commands[0].parameters, false);
  assert.equal(refreshed.includes("/dashboard"), true);
  assert.equal(Boolean((await createFollowUp({}, form({ due_date: "2026-02-30" }))).error), true);
  assert.equal(commands.length, 1);
  role = "receptionist";
  assert.equal(Boolean((await createFollowUp({}, form())).error), true);
  assert.equal(commands.length, 1);
  role = "doctor";
  for (const mode of ["throw", "return"]) {
    failure = mode;
    const result = await createFollowUp({}, form());
    assert.equal(Boolean(result.error), true);
    assert.equal(result.error.includes("Sensitive reason"), false);
  }
  failure = "none";
  assert.equal(Boolean((await transitionFollowUp(form({ follow_up_id: planId, status: "completed" }))).success), true);
  assert.equal(Boolean((await transitionFollowUp(form({ follow_up_id: planId, status: "planned" }))).error), true);

  const queries = [];
  let queryFailure = false;
  const row = {
    id: planId, patient_id: patientId, created_by: planId, consultation_id: null,
    due_date: "2026-10-13", reason: "<script>Synthetic review</script>", status: "planned",
    created_at: "2026-10-14T00:00:00+00:00", resolved_at: null,
    patient: { first_name: "Synthetic", last_name: "Patient", hospital_number: "TEST" },
  };
  const { getClinicFollowUps, getFollowUpHistory } = load("lib/follow-ups/history.ts", {
    ...clockMock,
    "@/lib/auth/context": { getClinicContext: async () => ({
      profile: { organization_id: clinicId },
      supabase: { from(table) {
        const entry = { table, filters: [], orders: [], limit: null };
        queries.push(entry);
        const query = {
          select(fields) { assert.equal(fields.includes("reason"), true); return query; },
          eq(key, value) { entry.filters.push([key, "eq", value]); return query; },
          lt(key, value) { entry.filters.push([key, "lt", value]); return query; },
          gte(key, value) { entry.filters.push([key, "gte", value]); return query; },
          order(key, options) { entry.orders.push([key, options.ascending]); return query; },
          limit(value) { entry.limit = value; return query; },
          or(value) { entry.cursor = value; return query; },
          then(resolve) { return Promise.resolve({ data: Array.from({ length: 26 }, () => row), error: queryFailure ? {} : null }).then(resolve); },
        };
        return query;
      } },
    }) },
  });
  const upcoming = await getClinicFollowUps("upcoming", encodeDueCursor({ due_date: today, id: planId }));
  assert.equal(upcoming.rows.length, 25);
  assert.equal(upcoming.hasMore, true);
  await getClinicFollowUps("overdue", "", 5);
  await getFollowUpHistory(patientId, "");
  assert.equal(queries[0].limit, 26);
  assert.equal(queries[1].limit, 6);
  assert.equal(queries[0].filters.some(([key, operator, value]) => key === "due_date" && operator === "gte" && value === today), true);
  assert.equal(queries[1].filters.some(([key, operator, value]) => key === "due_date" && operator === "lt" && value === today), true);
  assert.equal(queries[2].filters.some(([key, , value]) => key === "patient_id" && value === patientId), true);
  for (const query of queries) assert.equal(query.filters.some(([key, , value]) => key === "organization_id" && value === clinicId), true);
  assert.equal(JSON.stringify(queries[0].orders), JSON.stringify([["due_date", true], ["id", true]]));
  queryFailure = true;
  await assert.rejects(() => getClinicFollowUps("upcoming"), /Unable to load/);

  const uiMocks = {
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "@/components/shared/action-form": ({ children, ...props }) => React.createElement("form", { className: props.className }, children),
    "@/actions/follow-up": { transitionFollowUp() {} },
  };
  const FollowUpList = load("components/follow-ups/follow-up-list.tsx", uiMocks).default;
  const props = { rows: [row], today, userId: planId, canUpdate: true };
  const markup = renderToStaticMarkup(React.createElement(FollowUpList, props));
  assert.equal(markup.includes("Overdue"), true);
  assert.equal(markup.includes("<script>"), false);
  assert.equal(markup.includes("&lt;script&gt;"), true);
  assert.equal(markup.includes(`follow-up-status-${planId}`), true);
  assert.equal(markup.includes("lg:grid-cols-2"), true);
  assert.equal(renderToStaticMarkup(React.createElement(FollowUpList, { ...props, userId: patientId })).includes("Resolve plan"), false);
  assert.equal(renderToStaticMarkup(React.createElement(FollowUpList, { ...props, rows: [{ ...row, status: "completed" }] })).includes("Resolve plan"), false);
  assert.equal(renderToStaticMarkup(React.createElement(FollowUpList, { ...props, rows: [] })).includes("No follow-up plans"), true);
  let formState = {};
  let formPending = false;
  const FollowUpForm = load("components/follow-ups/follow-up-form.tsx", {
    ...uiMocks,
    react: {
      useActionState: () => [formState, () => {}, formPending],
      useRef: initial => ({ current: initial }),
      startTransition: callback => callback(),
    },
    "@/actions/follow-up": { createFollowUp() {} },
  }).default;
  const formProps = { patientId, today };
  const formMarkup = renderToStaticMarkup(React.createElement(FollowUpForm, formProps));
  assert.equal(formMarkup.includes('for="follow-up-date"'), true);
  assert.equal(formMarkup.includes('id="follow-up-date"'), true);
  assert.equal(formMarkup.includes('maxLength="2000"'), true);
  assert.equal(formMarkup.includes("send a reminder"), true);
  formState = { error: "Synthetic error" };
  formPending = true;
  const failedMarkup = renderToStaticMarkup(React.createElement(FollowUpForm, formProps));
  assert.equal(failedMarkup.includes('role="alert"'), true);
  assert.equal(failedMarkup.includes("Saving follow-up"), true);
  assert.equal(failedMarkup.includes("disabled"), true);
  formState = { success: "Synthetic saved" };
  formPending = false;
  assert.equal(renderToStaticMarkup(React.createElement(FollowUpForm, formProps)).includes("Review follow-up history"), true);
  let overviewFailure = false;
  const previewCalls = [];
  const FollowUpOverview = load("components/follow-ups/follow-up-overview.tsx", {
    ...uiMocks,
    "@/lib/follow-ups/history": { getClinicFollowUps: async (window, cursor, limit) => {
      previewCalls.push({ window, cursor, limit });
      if (overviewFailure) throw new Error("Synthetic failure");
      return { rows: [row], hasMore: false };
    } },
  }).default;
  const previewMarkup = renderToStaticMarkup(await FollowUpOverview());
  assert.equal(previewMarkup.includes("Upcoming follow-ups"), true);
  assert.equal(previewMarkup.includes("Overdue recall review"), true);
  assert.equal(previewMarkup.includes("Synthetic review"), false);
  assert.equal(previewCalls.every(call => call.limit === 5), true);
  overviewFailure = true;
  const previewError = renderToStaticMarkup(await FollowUpOverview());
  assert.equal(previewError.includes('role="alert"'), true);
  assert.equal(previewError.includes("No plans in this list"), false);
  console.log("PASS: follow-up capability matrix, validated dates/reasons/IDs, forged identity rejection, safe RPC errors, status actions, clinic/patient scope, bounded due-date keysets, upcoming/overdue filters, escaped responsive cards and owner/terminal controls.");
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
