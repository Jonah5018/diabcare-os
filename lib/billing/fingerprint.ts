import "server-only";

import { createHash } from "node:crypto";
import type { NormalizedBillingEvent } from "@/types/billing";

export function billingEventFingerprint(event: NormalizedBillingEvent) {
  const fields = [
    event.provider, event.id, event.customer, event.subscription, event.plan,
    event.status, event.occurredAt, event.trialEndsAt, event.periodEndsAt,
  ];
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}
