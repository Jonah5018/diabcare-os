import "server-only";

import { timingSafeEqual } from "node:crypto";

export function operationsConfiguration() {
  return {
    enabled: process.env.OPERATIONS_ENDPOINTS_ENABLED === "true",
    secret: process.env.OPERATIONS_CRON_SECRET || process.env.CRON_SECRET || "",
  };
}

export function authorizeOperations(request: Request, configuration = operationsConfiguration()) {
  if (!configuration.enabled || configuration.secret.length < 32) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuration.secret}`;
  if (supplied.length !== expected.length) return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(suppliedBytes, expectedBytes);
}

export function operationsStatus() {
  const configuration = operationsConfiguration();
  return {
    automatic_worker_configured: configuration.enabled && configuration.secret.length >= 32
      && Boolean(process.env.SUPABASE_OPERATIONS_KEY),
    billing_webhook_enabled: process.env.BILLING_WEBHOOK_ENABLED === "true",
  };
}
