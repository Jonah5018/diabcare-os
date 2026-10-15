import { z } from "zod";
import { DOCUMENT_MAX_BYTES, documentCategories, documentTypes } from "@/lib/documents/config";

export const documentUploadSchema = z.object({
  patient_id: z.uuid(),
  request_id: z.uuid(),
  category: z.enum(documentCategories),
});

export const documentRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  patient_id: z.uuid(),
  uploaded_by: z.uuid(),
  request_id: z.uuid(),
  display_name: z.string().min(1).max(160),
  category: z.enum(documentCategories),
  content_type: z.enum(documentTypes),
  size_bytes: z.number().int().min(1).max(DOCUMENT_MAX_BYTES),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  object_path: z.string(),
  status: z.enum(["pending", "ready"]),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
