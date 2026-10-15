import { z } from "zod";

export const authEmailSchema = z.string().trim().max(254).email("Enter a valid email address.");

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(12, "Use at least 12 characters for your new password.")
    .max(128, "Use no more than 128 characters.")
    .refine(value => value.trim().length > 0, "Choose a password that is not only spaces."),
  confirmation: z.string().min(1, "Confirm your new password."),
}).refine(value => value.password === value.confirmation, {
  message: "Your passwords do not match. Please check both fields.",
  path: ["confirmation"],
});
