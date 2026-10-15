import "server-only";

import { z } from "zod";
import { getPlatformContext } from "@/lib/platform/context";
import { PAGE_SIZE } from "@/lib/pagination";

const clinicSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  operational_status: z.enum(["active", "suspended"]),
  subscription_status: z.string().nullable(),
  plan_id: z.string().nullable(),
});
const directorySchema = clinicSchema.extend({ created_at: z.iso.datetime({ offset: true }).nullable() });
const cursorSchema = z.object({ id: z.uuid(), created_at: z.iso.datetime({ offset: true }).nullable() });

export async function getPlatformOrganizations(cursor: string) {
  const { supabase } = await getPlatformContext();
  let key: z.infer<typeof cursorSchema> | null = null;
  if (cursor) {
    if (cursor.length > 400) throw new Error("Invalid clinic directory cursor");
    key = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  }
  const { data, error } = await supabase.rpc("platform_organizations", {
    p_cursor_time: key?.created_at ?? null,
    p_cursor_id: key?.id ?? null,
  });
  if (error) throw new Error("Unable to load platform clinic directory");
  const rows = z.array(directorySchema).max(PAGE_SIZE + 1).parse(data ?? []);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export async function getPlatformOverview() {
  const { supabase } = await getPlatformContext();
  const { data, error } = await supabase.rpc("platform_overview");
  if (error) throw new Error("Unable to load platform metrics");
  const count = z.number().int().nonnegative();
  return z.object({ clinics: count, active_clinics: count, suspended_clinics: count,
    managed_subscriptions: count, past_due_subscriptions: count }).parse(data);
}

export async function getPlatformClinic(id: string) {
  z.uuid().parse(id);
  const { supabase } = await getPlatformContext();
  const { data, error } = await supabase.rpc("platform_clinic_details", { p_clinic: id });
  if (error) throw new Error("Clinic unavailable");
  return clinicSchema.extend({
    staff_count: z.number().int().nonnegative(),
    patient_count: z.number().int().nonnegative(),
    binding_configured: z.boolean(),
  }).parse(data);
}
