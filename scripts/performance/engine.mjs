import { performance } from "node:perf_hooks";

export function summarize(samples) {
  const times = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
  const percentile = value => times.length ? times[Math.max(0, Math.ceil(times.length * value) - 1)] : null;
  const failures = samples.filter(sample => !sample.ok).length;

  return {
    requests: samples.length,
    failures,
    errorRate: samples.length ? failures / samples.length : 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
  };
}

export async function runWorkload({ scenarios, requests = 50, concurrency = 4 }) {
  if (!Number.isInteger(requests) || requests < 1 || requests > 1000) throw new Error("Use 1–1000 requests.");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("Use 1–8 concurrent requests.");
  if (!scenarios.length || scenarios.some(scenario => !/^[a-z_]+$/.test(scenario.name))) {
    throw new Error("Choose named supported scenarios.");
  }

  const samples = [];
  let next = 0;
  const started = performance.now();

  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, async () => {
    while (next < requests) {
      const index = next++;
      const scenario = scenarios[index % scenarios.length];
      const start = performance.now();
      let ok = false;
      try {
        await scenario.run(index);
        ok = true;
      } catch {
        // Never serialize transport errors, SQL details, patient rows or credentials.
      }
      samples.push({ scenario: scenario.name, ok, durationMs: performance.now() - start });
    }
  }));

  return {
    scope: "synthetic authenticated Data API/RPC workload; not browser or production capacity",
    elapsedMs: performance.now() - started,
    concurrency,
    ...summarize(samples),
    scenarios: Object.fromEntries(scenarios.map(scenario => [scenario.name, summarize(samples.filter(sample => sample.scenario === scenario.name))])),
  };
}
