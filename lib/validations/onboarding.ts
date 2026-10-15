import { z } from "zod";

export const inviteRoles = ["organization_admin", "doctor", "nurse", "receptionist", "lab_scientist"] as const;
const name = z.string().trim().min(1).max(200);
const email = z.email().trim().toLowerCase().max(254);

export const clinicProvisionSchema = z.object({
  name,
  slug: z.string().min(3).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  admin_email: email,
  admin_name: name,
});
export const staffInviteSchema = z.object({ email, full_name: name, role: z.enum(inviteRoles) });
export const clinicProfileSchema = z.object({
  name,
  email: z.union([email, z.literal("")]),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(500),
});
export const invitationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const invitationResponseSchema = z.object({ token: invitationTokenSchema, organization_id: z.uuid(), invitation_id: z.uuid() });
