import { z } from "zod";
import { inviteRoles } from "@/lib/validations/onboarding";

export const staffRoleSchema = z.object({
  staff_id: z.uuid(),
  role: z.enum(inviteRoles),
  expected_role: z.enum(inviteRoles),
});
