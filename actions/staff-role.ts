"use server";

import {
  administrationContext,
  refreshAdministration,
  runAdministrationCommand,
} from "@/lib/onboarding/commands";
import { staffRoleSchema } from "@/lib/validations/staff-role";
import type { AdministrationResult } from "@/types/onboarding";

export async function changeStaffRole(form: FormData): Promise<AdministrationResult> {
  const { supabase, user } = await administrationContext("team:roles");
  const result = staffRoleSchema.safeParse({
    staff_id: form.get("staff_id"),
    role: form.get("role"),
    expected_role: form.get("expected_role"),
  });
  if (!result.success) return { error: "Choose a valid clinic role and staff record." };
  if (result.data.staff_id === user.id) return { error: "You cannot change your own role." };

  const saved = await runAdministrationCommand(supabase, "change_staff_role", {
    p_staff_id: result.data.staff_id,
    p_role: result.data.role,
    p_expected_role: result.data.expected_role,
  });
  if (!saved) {
    return { error: "Role could not be changed. Refresh the team page. Platform-owner and last active administrator accounts are protected." };
  }

  refreshAdministration();
  return { success: "Staff role updated. Pending invitations issued by a demoted administrator are revoked." };
}
