import "server-only";

import { DOCUMENT_BUCKET } from "@/lib/documents/config";
import { documentChecksum } from "@/lib/documents/file";
import type { ClinicalDocument } from "@/types/document";
import type { getClinicContext } from "@/lib/auth/context";

type ClinicClient = Awaited<ReturnType<typeof getClinicContext>>["supabase"];

export async function verifyStoredDocument(supabase: ClinicClient, document: ClinicalDocument) {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(document.object_path);
  if (error || !data || data.size !== document.size_bytes) throw new Error("Stored document unavailable or size mismatch");
  const checksum = documentChecksum(new Uint8Array(await data.arrayBuffer()), document.content_type);
  if (checksum !== document.checksum) throw new Error("Stored document checksum mismatch");
}

export async function finalizeDocument(supabase: ClinicClient, document: ClinicalDocument) {
  const { error } = await supabase.rpc("finalize_clinical_document", { p_document_id: document.id });
  if (error) throw new Error("Document verification could not be saved");
}
