/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");

const patientId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const { encodeTimelineCursor, decodeTimelineCursor } = load("lib/timeline/cursor.ts");
const cursor = { time: "2026-01-01T10:00:00.123456+00:00", kind: "consultation_recorded", id: sourceId };
assert.equal(JSON.stringify(decodeTimelineCursor(encodeTimelineCursor(cursor))), JSON.stringify(cursor));
assert.equal(decodeTimelineCursor(encodeTimelineCursor({ ...cursor, time: null })).time, null);
for (const invalid of ["", "!invalid", "a".repeat(601), Buffer.from('{"kind":"injection"}').toString("base64url")]) {
  assert.equal(decodeTimelineCursor(invalid), null);
}
assert.throws(() => encodeTimelineCursor({ ...cursor, id: "invalid" }));

async function verify() {
  let fail = false;
  let rows = Array.from({ length: 26 }, () => ({
    event_kind: cursor.kind,
    source_id: sourceId,
    occurred_at: cursor.time,
    appointment_id: null,
    details: { diagnosis: "<script>Synthetic only</script>" },
    organization_id: "should-not-escape-dto",
  }));
  const calls = [];
  const { getPatientTimeline } = load("lib/timeline/history.ts", {
    "@/lib/auth/context": { getClinicContext: async () => ({
      supabase: { rpc: async (name, params) => {
        calls.push({ name, params });
        return { data: rows, error: fail ? { code: "synthetic" } : null };
      } },
    }) },
  });
  const history = await getPatientTimeline(patientId, encodeTimelineCursor(cursor));
  assert.equal(history.rows.length, 25);
  assert.equal(history.hasMore, true);
  assert.equal("organization_id" in history.rows[0], false);
  assert.equal(calls[0].name, "get_patient_timeline");
  assert.equal(calls[0].params.p_limit, 26);
  assert.equal(calls[0].params.p_patient_id, patientId);
  assert.equal(calls[0].params.p_cursor_time, cursor.time);
  assert.equal("p_organization_id" in calls[0].params, false);
  await assert.rejects(() => getPatientTimeline(patientId, "!bad"), /Invalid timeline cursor/);
  assert.equal(calls.length, 1);
  await assert.rejects(() => getPatientTimeline("invalid", ""));
  fail = true;
  await assert.rejects(() => getPatientTimeline(patientId, ""), /Unable to load/);
  fail = false;
  rows = [];
  assert.equal((await getPatientTimeline(patientId, "")).hasMore, false);

  const uiMocks = {
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
  };
  const TimelineList = load("components/timeline/timeline-list.tsx", uiMocks).default;
  const renderedRows = [
    { ...history.rows[0], appointment_id: sourceId },
    { ...history.rows[0], source_id: patientId, occurred_at: null, event_kind: "vitals_recorded", details: { bmi: null, systolic_bp: 0 } },
    { ...history.rows[0], event_kind: "laboratory_recorded", details: { creatinine: 80 } },
  ];
  const markup = renderToStaticMarkup(React.createElement(TimelineList, { rows: renderedRows, patientId }));
  assert.equal(markup.includes("Time not recorded"), true);
  assert.equal(markup.includes("Not recorded"), true);
  assert.equal(markup.includes("<script>"), false);
  assert.equal(markup.includes("&lt;script&gt;"), true);
  assert.equal(markup.includes(`appointment=${sourceId}`), true);
  assert.equal(markup.includes("sm:grid-cols-2"), true);
  assert.equal(markup.includes("Creatinine (µmol/L)"), true);
  assert.equal(renderToStaticMarkup(React.createElement(TimelineList, { rows: [], patientId })).includes("No recorded events"), true);

  let moduleFailure = false;
  const TimelineModule = load("components/timeline/timeline-module.tsx", {
    ...uiMocks,
    "@/components/timeline/timeline-list": TimelineList,
    "@/components/shared/pagination": props => React.createElement("nav", {
      "data-parameter": props.parameter,
      "data-other-cursor": props.query.labCursor,
      "data-cursor": props.cursor,
    }),
    "@/lib/timeline/history": { getPatientTimeline: async () => {
      if (moduleFailure) throw new Error("sensitive database details");
      return { rows: renderedRows, hasMore: true };
    } },
  }).default;
  const moduleProps = { patientId, cursor: "", query: { labCursor: "preserved" } };
  const moduleMarkup = renderToStaticMarkup(await TimelineModule(moduleProps));
  assert.equal(moduleMarkup.includes('data-parameter="timelineCursor"'), true);
  assert.equal(moduleMarkup.includes('data-other-cursor="preserved"'), true);
  moduleFailure = true;
  const errorMarkup = renderToStaticMarkup(await TimelineModule(moduleProps));
  assert.equal(errorMarkup.includes('role="alert"'), true);
  assert.equal(errorMarkup.includes("sensitive database details"), false);
  assert.equal(errorMarkup.includes("No recorded events"), false);

  console.log("PASS: precise/nullable validated cursors, fixed RPC limit and patient scope, minimal DTO, safe failures, escaped previews, legacy/empty states, responsive cards, visit links and independent pagination.");
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
