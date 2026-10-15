import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BillingProvider, NormalizedBillingEvent, SubscriptionStatus } from "@/types/billing";

const stripeEventSchema = z.object({
  id: z.string().min(1).max(200),
  created: z.number().int().nonnegative(),
  type: z.string(),
  data: z.object({ object: z.unknown() }),
});
const subscriptionSchema = z.object({
  id: z.string().regex(/^sub_[A-Za-z0-9]+$/),
  customer: z.string().regex(/^cus_[A-Za-z0-9]+$/),
  status: z.string(),
  trial_end: z.number().int().nullable().optional(),
  current_period_end: z.number().int().nullable().optional(),
  items: z.object({ data: z.array(z.object({
    price: z.object({ id: z.string() }),
    current_period_end: z.number().int().optional(),
  })).min(1).max(20) }),
});
const statuses: Record<string, SubscriptionStatus> = {
  trialing: "trial", active: "active", past_due: "past_due", unpaid: "past_due",
  incomplete: "past_due", incomplete_expired: "cancelled", canceled: "cancelled", paused: "suspended",
};

export function stripeBillingProvider(secret: string, pricePlans: Record<string, "core" | "plus">): BillingProvider {
  if (secret.length < 16) throw new Error("Billing signing secret is not configured");
  return {
    name: "stripe",
    verifyAndNormalize(body, signature, nowSeconds) {
      if (signature.length > 2048) throw new Error("Invalid webhook signature");
      const fields = signature.split(",").map(field => field.split("="));
      const stamp = fields.find(([key]) => key === "t")?.[1] ?? "";
      if (!/^\d+$/.test(stamp) || Math.abs(nowSeconds - Number(stamp)) > 300) throw new Error("Expired webhook signature");
      const expected = createHmac("sha256", secret).update(`${stamp}.${body}`).digest();
      const verified = fields.filter(([key]) => key === "v1").some(([, value]) => {
        if (!/^[0-9a-f]{64}$/.test(value ?? "")) return false;
        return timingSafeEqual(expected, Buffer.from(value, "hex"));
      });
      if (!verified) throw new Error("Invalid webhook signature");
      const event = stripeEventSchema.parse(JSON.parse(body));
      if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return null;
      const subscription = subscriptionSchema.parse(event.data.object);
      const firstItem = subscription.items.data[0];
      const plan = Object.hasOwn(pricePlans, firstItem.price.id) ? pricePlans[firstItem.price.id] : null;
      const status = event.type === "customer.subscription.deleted" ? "cancelled"
        : Object.hasOwn(statuses, subscription.status) ? statuses[subscription.status] : null;
      if (!plan || !status || subscription.items.data.length !== 1) throw new Error("Billing event needs supported price/status reconciliation");
      const timestamp = (value: number | null | undefined) => value == null ? null : new Date(value * 1000).toISOString();
      return {
        provider: "stripe", id: event.id, customer: subscription.customer, subscription: subscription.id,
        plan, status, occurredAt: event.created,
        trialEndsAt: timestamp(subscription.trial_end),
        periodEndsAt: timestamp(subscription.current_period_end ?? firstItem.current_period_end),
      } satisfies NormalizedBillingEvent;
    },
  };
}
