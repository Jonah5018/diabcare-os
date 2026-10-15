import "server-only";

import { z } from "zod";

const eventSchema = z.object({
  event: z.enum(["notification_batch", "billing_webhook", "readiness_probe", "auth_check", "clinical_write", "unhandled_request"]),
  request_id: z.uuid(),
  outcome: z.enum(["ok", "rejected", "failed", "unavailable", "uncertain"]),
  duration_ms: z.number().int().min(0).max(600000).optional(),
  count: z.number().int().min(0).max(10000).optional(),
});

export function newRequestId() {
  return crypto.randomUUID();
}

// Runtime validation strips extra fields even from untyped callers. Never pass
// error objects, URLs, payloads, identities, clinical fields or credentials.
export function emitOperationalEvent(input: z.infer<typeof eventSchema>) {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return;
  const severity = parsed.data.outcome === "ok" ? "info" : parsed.data.outcome === "failed" ? "error" : "warn";
  const line = JSON.stringify({ timestamp: new Date().toISOString(), severity, ...parsed.data });
  if (parsed.data.outcome === "ok") console.info(line);
  else console.warn(line);
}
