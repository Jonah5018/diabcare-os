import { performance } from "node:perf_hooks";

const target = new URL(process.argv[2] || "http://127.0.0.1:3000/api/health");
const requests = Number(process.argv[3] || 50);
const concurrency = Number(process.argv[4] || 5);
if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.pathname !== "/api/health") {
  throw new Error("This smoke test accepts only a local /api/health endpoint. Use a dedicated staging load test for clinical routes.");
}
if (!Number.isInteger(requests) || requests < 1 || requests > 1000 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
  throw new Error("Use 1–1000 requests and 1–32 concurrent requests.");
}
const times = [];
let next = 0, failures = 0;
const started = performance.now();
await Promise.all(Array.from({ length: Math.min(requests, concurrency) }, async () => {
  while (next++ < requests) {
    const start = performance.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      if (!response.ok || body.status !== "ok") failures++;
    } catch { failures++; }
    times.push(performance.now() - start);
  }
}));
times.sort((a, b) => a - b);
console.log(JSON.stringify({ scope: "local liveness smoke test; not clinical capacity", requests, concurrency, failures, elapsedMs: Math.round(performance.now() - started), p50Ms: Math.round(times[Math.floor(times.length * 0.5)]), p95Ms: Math.round(times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]) }, null, 2));
if (failures) process.exitCode = 1;
