import { z } from "zod";

export const clinicStatusSchema = z.object({
  clinic_id: z.uuid(),
  status: z.enum(["active", "suspended"]),
  expected: z.enum(["active", "suspended"]),
  reason: z.enum(["operational_review", "security_review", "clinic_request", "resolved"]),
});

export const billingBindingSchema = z.object({
  clinic_id: z.uuid(),
  customer: z.string().regex(/^cus_[A-Za-z0-9]{1,180}$/),
  subscription: z.string().regex(/^sub_[A-Za-z0-9]{1,180}$/),
});
