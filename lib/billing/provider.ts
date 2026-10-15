import "server-only";

import { z } from "zod";
import { stripeBillingProvider } from "@/lib/billing/stripe";

export function configuredBillingProvider() {
  if (process.env.BILLING_WEBHOOK_ENABLED !== "true") return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const mapping = process.env.STRIPE_PRICE_PLANS;
  if (!secret || !mapping) throw new Error("Billing webhook is not configured");
  const plans = z.record(z.string().regex(/^price_[A-Za-z0-9]+$/), z.enum(["core", "plus"]))
    .parse(JSON.parse(mapping));
  if (!Object.keys(plans).length) throw new Error("Billing price mapping is empty");
  return stripeBillingProvider(secret, plans);
}
