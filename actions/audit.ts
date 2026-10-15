"use server";

import { revalidatePath } from "next/cache";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { retentionDraftSchema } from "@/lib/validations/audit";
import type { AdministrationResult } from "@/types/onboarding";

export async function saveRetentionDraft(form: FormData): Promise<AdministrationResult> {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "team:manage")) return { error: "Your role cannot edit retention drafts" };
  const parsed = retentionDraftSchema.safeParse({ days: form.get("days"), hold: form.get("hold") === "on" });
  if (!parsed.success) return { error: "Choose 1–36,500 days or leave the period undecided" };
  try {
    const { error } = await supabase.rpc("save_audit_retention_draft", {
      p_days: parsed.data.days, p_hold: parsed.data.hold,
    });
    if (error) return { error: "Unable to save the retention draft. Refresh and try again." };
  } catch {
    return { error: "Unable to save the retention draft. Refresh and try again." };
  }
  revalidatePath("/dashboard/audit");
  return { success: "Draft saved. Automated deletion remains disabled." };
}
