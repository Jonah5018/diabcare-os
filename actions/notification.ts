"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { runNotificationBatch } from "@/lib/notifications/worker";
import type { AdministrationResult } from "@/types/onboarding";

export async function queueClinicNotice(form: FormData): Promise<AdministrationResult> {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "notifications:manage")) return { error: "Your role cannot queue clinic notices" };
  const request = z.uuid().safeParse(form.get("request_id"));
  if (!request.success) return { error: "Invalid notification request" };
  try {
    const { error } = await supabase.rpc("queue_clinic_notice", { p_request: request.data });
    if (error) throw new Error("Notice not queued");
  } catch {
    return { error: "Notice could not be queued. Check its history before retrying." };
  }
  revalidatePath("/dashboard/notifications");
  return { success: "Internal notice queued. No patient message was sent." };
}

export async function processClinicNotifications(): Promise<AdministrationResult> {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "notifications:manage")) return { error: "Your role cannot process notification jobs" };
  try {
    const result = await runNotificationBatch(supabase);
    revalidatePath("/dashboard/notifications");
    return { success: `${result.delivered} clinic inbox deliveries confirmed; ${result.suppressed} obsolete events suppressed; ${result.uncertain} attempts need reconciliation.` };
  } catch {
    return { error: "Unable to process the notification batch. Refresh its history." };
  }
}
