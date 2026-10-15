import type { z } from "zod";
import type { documentRowSchema } from "@/lib/validations/document";

export type ClinicalDocument = z.infer<typeof documentRowSchema>;
export interface DocumentResult {
  error?: string;
  success?: string;
  signedUrl?: string;
  expiresAt?: number;
}
