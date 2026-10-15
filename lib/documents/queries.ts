import "server-only";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/context";
import { cursorFilter, PAGE_SIZE } from "@/lib/pagination";
import { documentRowSchema } from "@/lib/validations/document";

export const documentSelection = "id, organization_id, patient_id, uploaded_by, request_id, display_name, category, content_type, size_bytes, checksum, object_path, status, created_at, updated_at";

export async function getDocumentHistory(patientId: string, cursor: string) {
  z.uuid().parse(patientId);
  const { supabase, profile } = await requirePermission("documents:view");
  let query = supabase.from("clinical_documents").select(documentSelection)
    .eq("organization_id", profile.organization_id).eq("patient_id", patientId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  const filter = cursorFilter(cursor);
  if (cursor && !filter) throw new Error("Invalid document history cursor");
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load patient document history");
  return { rows: z.array(documentRowSchema).parse(data ?? []).slice(0, PAGE_SIZE), hasMore: (data?.length ?? 0) > PAGE_SIZE };
}

export async function getClinicDocument(id: string) {
  z.uuid().parse(id);
  const context = await requirePermission("documents:view");
  const { data, error } = await context.supabase.from("clinical_documents").select(documentSelection)
    .eq("id", id).eq("organization_id", context.profile.organization_id).maybeSingle();
  if (error || !data) throw new Error("Document unavailable in your clinic");
  return { ...context, document: documentRowSchema.parse(data) };
}
