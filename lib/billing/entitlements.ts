import "server-only";

import { cache } from "react";
import { z } from "zod";
import { getClinicContext } from "@/lib/auth/context";
import type { EntitlementFeature } from "@/types/billing";

const entitlementSchema = z.object({
  legacy_access: z.boolean(),
  features: z.object({ storage: z.boolean(), communications: z.boolean(), advanced_reports: z.boolean() }),
  subscription: z.object({
    plan: z.string(),
    plan_id: z.enum(["core", "plus"]),
    status: z.enum(["trial", "active", "past_due", "suspended", "cancelled"]),
    trial_ends_at: z.string().nullable(),
    current_period_end: z.string().nullable(),
    staff_limit: z.number().int().positive().nullable(),
    patient_limit: z.number().int().positive().nullable(),
  }).nullable(),
});

export const getClinicEntitlements = cache(async () => {
  const { supabase } = await getClinicContext();
  const { data, error } = await supabase.rpc("get_clinic_entitlements");
  if (error) throw new Error("Unable to load clinic entitlements");
  return entitlementSchema.parse(data);
});

export async function requireFeature(feature: EntitlementFeature) {
  const entitlements = await getClinicEntitlements();
  if (!entitlements.features[feature]) throw new Error("This optional feature is unavailable under the clinic's billing configuration");
  return entitlements;
}
