import "server-only";

import { requirePermission } from "@/lib/auth/context";
import { operationalReportSchema } from "@/lib/reports/metrics";

export async function getOperationalReport(from: string, to: string) {
  const { supabase } = await requirePermission("reports:view");
  const { data, error } = await supabase.rpc("get_clinic_operational_report", { p_from: from, p_to: to });
  if (error) throw new Error("Unable to load clinic reports");
  return operationalReportSchema.parse(data);
}
