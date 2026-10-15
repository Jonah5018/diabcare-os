import "server-only";

import { z } from "zod";
import { getPlatformContext } from "@/lib/platform/context";

export async function getOperationsSnapshot() {
  const { supabase } = await getPlatformContext();
  const { data, error } = await supabase.rpc("platform_operations_snapshot");
  if (error) throw new Error("Unable to load operational diagnostics");
  const count = z.number().int().nonnegative();
  return z.object({
    failed_notifications: count,
    expired_leases: count,
    due_notifications: count,
    oldest_due_seconds: count,
    billing_reconciliation: count,
    expired_billing_periods: count,
  }).parse(data);
}
