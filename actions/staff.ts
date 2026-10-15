"use server";

import { z } from "zod";
import { administrationContext, refreshAdministration, runAdministrationCommand } from "@/lib/onboarding/commands";
import { invitationResponseSchema, staffInviteSchema } from "@/lib/validations/onboarding";
import type { AdministrationResult } from "@/types/onboarding";

export async function inviteStaff(form: FormData): Promise<AdministrationResult> {
  const { supabase, profile } = await administrationContext("team:manage");
  const result = staffInviteSchema.safeParse({ email: form.get("email"), full_name: form.get("full_name"), role: form.get("role") });
  const clinic = profile.role === "platform_owner" && form.get("clinic_id")
    ? z.uuid().safeParse(form.get("clinic_id")) : z.uuid().safeParse(profile.organization_id);
  if (!result.success || !clinic.success) return { error: "Invalid staff invitation details." };
  const saved = await runAdministrationCommand(supabase, "invite_clinic_staff", {
    p_clinic: clinic.data, p_email: result.data.email, p_name: result.data.full_name, p_role: result.data.role,
  });
  const response = invitationResponseSchema.safeParse(saved?.data);
  if (!response.success) return { error: "Invitation could not be issued. Check pending invitations before retrying." };
  refreshAdministration();
  return { success: "Invitation issued for seven days. A previous pending invitation for this clinic/email is revoked.", invitationPath: `/auth/invitation#token=${response.data.token}` };
}

export async function revokeInvitation(form: FormData): Promise<AdministrationResult> {
  const { supabase } = await administrationContext("team:manage");
  const id = z.uuid().safeParse(form.get("invitation_id"));
  if (!id.success) return { error: "Invalid invitation." };
  const saved = await runAdministrationCommand(supabase, "revoke_staff_invitation", { p_id: id.data });
  if (!saved) return { error: "Invitation could not be revoked." };
  refreshAdministration();
  return { success: "Pending invitation revoked." };
}

export async function setStaffActivity(form: FormData): Promise<AdministrationResult> {
  const { supabase } = await administrationContext("team:manage");
  const result = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }).safeParse({ id: form.get("staff_id"), active: form.get("active") });
  if (!result.success) return { error: "Invalid staff action." };
  const saved = await runAdministrationCommand(supabase, "set_staff_activity", { p_id: result.data.id, p_active: result.data.active === "true" });
  if (!saved) return { error: "Staff activity could not be changed. Self, platform owner and last administrator accounts are protected." };
  refreshAdministration();
  return { success: "Staff activity updated." };
}
