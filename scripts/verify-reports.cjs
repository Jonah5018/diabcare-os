/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");
const { operationalReportSchema, metricLabels } = load("lib/reports/metrics.ts");
const sample = Object.fromEntries(Object.keys(metricLabels).map(key => [key, 1]));
assert.equal(operationalReportSchema.safeParse(sample).success, true);
assert.equal(operationalReportSchema.safeParse({ ...sample, bookings: -1 }).success, false);
(async () => {
  const calls = [];
  let failed = false;
  const { getOperationalReport } = load("lib/reports/queries.ts", {
    "@/lib/auth/context": { requirePermission: async permission => {
      assert.equal(permission, "reports:view");
      return { supabase: { rpc: async (name, parameters) => {
        calls.push({ name, parameters });
        return { data: sample, error: failed ? {} : null };
      } } };
    } },
  });
  await getOperationalReport("2026-10-01", "2026-10-14");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "get_clinic_operational_report");
  assert.equal("p_organization_id" in calls[0].parameters, false);
  failed = true;
  await assert.rejects(() => getOperationalReport("2026-10-01", "2026-10-14"), /Unable to load/);
  const Summary = load("components/reports/operational-summary.tsx").default;
  const markup = renderToStaticMarkup(React.createElement(Summary, { report: sample }));
  assert.equal(markup.includes("do not assess clinical adequacy"), true);
  assert.equal(markup.includes("sm:grid-cols-2"), true);
  console.log("PASS: report DTO validation, single aggregate RPC, server capability/no clinic input, safe failures, responsive metrics and explicit operational/clinical interpretation boundaries.");
})().catch(error => { console.error(error); process.exitCode = 1; });
