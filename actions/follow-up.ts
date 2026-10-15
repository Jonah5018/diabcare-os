"use server";

import { revalidatePath } from "next/cache";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { followUpSchema, followUpTransitionSchema } from "@/lib/validations/follow-up";
import type { FollowUpResult } from "@/types/follow-up";

type ClinicClient = Awaited<ReturnType<typeof getClinicContext>>["supabase"];

async function executeCommand(supabase: ClinicClient, name: string, parameters: Record<string, unknown>) {
  try {
    const { error } = await supabase.rpc(name, parameters);
    return !error;
  } catch {
    return false;
  }
}

function refreshFollowUps() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/follow-ups");
  revalidatePath("/dashboard/patients/[id]", "page");
  revalidatePath("/dashboard/audit");
}

export async function createFollowUp(_previous: FollowUpResult, form: FormData): Promise<FollowUpResult> {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "follow-ups:create")) return { error: "Your role cannot plan follow-ups" };

  const result = followUpSchema.safeParse({
    patient_id: form.get("patient_id"),
    consultation_id: form.get("consultation_id"),
    due_date: form.get("due_date"),
    reason: form.get("reason"),
    request_id: form.get("request_id"),
  });
  if (!result.success) return { error: result.error.issues[0].message };

  const values = result.data;
  const saved = await executeCommand(supabase, "create_follow_up", {
    p_patient_id: values.patient_id,
    p_consultation_id: values.consultation_id,
    p_due_date: values.due_date,
    p_reason: values.reason,
    p_request_id: values.request_id,
  });
  if (!saved) return { error: "Plan could not be saved. Check follow-up history before retrying." };

  refreshFollowUps();
  return { success: "Follow-up planned. No reminder has been sent." };
}

export async function transitionFollowUp(form: FormData): Promise<FollowUpResult> {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "follow-ups:update")) return { error: "Your role cannot update follow-ups" };
  const result = followUpTransitionSchema.safeParse({ follow_up_id: form.get("follow_up_id"), status: form.get("status") });
  if (!result.success) return { error: "Invalid follow-up action" };

  const saved = await executeCommand(supabase, "transition_follow_up", {
    p_follow_up_id: result.data.follow_up_id,
    p_status: result.data.status,
  });
  if (!saved) return { error: "Plan could not be updated. Refresh its history and try again." };

  refreshFollowUps();
  return { success: "Follow-up status updated." };
}
