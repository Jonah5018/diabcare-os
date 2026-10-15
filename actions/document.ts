"use server";

import { revalidatePath } from "next/cache";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { documentRowSchema, documentUploadSchema } from "@/lib/validations/document";
import { prepareDocument } from "@/lib/documents/file";
import { getClinicDocument } from "@/lib/documents/queries";
import { finalizeDocument, verifyStoredDocument } from "@/lib/documents/storage";
import { DOCUMENT_BUCKET, DOCUMENT_LINK_SECONDS } from "@/lib/documents/config";
import type { DocumentResult } from "@/types/document";

function refreshDocuments(patientId: string) {
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/audit");
}

export async function uploadDocument(_previous: DocumentResult, form: FormData): Promise<DocumentResult> {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "documents:upload")) return { error: "Your role cannot upload patient documents" };
  const parsed = documentUploadSchema.safeParse({ patient_id: form.get("patient_id"), request_id: form.get("request_id"), category: form.get("category") });
  if (!parsed.success) return { error: "Choose a valid patient, category and upload request" };
  let file;
  try {
    file = await prepareDocument(form.get("file"));
  } catch {
    return { error: "Choose a PDF, PNG or JPEG with a matching file signature, up to 768 KiB." };
  }
  try {
    const { data, error } = await supabase.rpc("reserve_clinical_document", {
      p_patient_id: parsed.data.patient_id, p_request_id: parsed.data.request_id,
      p_name: file.name, p_category: parsed.data.category, p_type: file.contentType,
      p_size: file.size, p_checksum: file.checksum,
    });
    if (error) throw new Error("Reservation failed");
    const document = documentRowSchema.parse(data);
    if (document.status !== "ready") {
      const uploaded = await supabase.storage.from(DOCUMENT_BUCKET).upload(document.object_path, file.bytes, {
        contentType: file.contentType, upsert: false, cacheControl: "0",
      });
      // A timeout or conflict can mean the previous attempt stored the object.
      if (uploaded.error) await verifyStoredDocument(supabase, document);
      await finalizeDocument(supabase, document);
    }
    refreshDocuments(document.patient_id);
    return { success: "Document saved in private patient storage." };
  } catch {
    refreshDocuments(parsed.data.patient_id);
    return { error: "Upload not confirmed. Review pending documents and resume verification, or retry the same file. At most 10 pending uploads are allowed per uploader." };
  }
}

export async function resumeDocument(form: FormData): Promise<DocumentResult> {
  try {
    const { supabase, profile, document } = await getClinicDocument(String(form.get("document_id") ?? ""));
    if (!can(profile.role, "documents:upload") || (document.uploaded_by !== profile.id
      && !["platform_owner", "organization_admin"].includes(profile.role))) {
      return { error: "Your role cannot verify this upload" };
    }
    if (document.status !== "ready") {
      await verifyStoredDocument(supabase, document);
      await finalizeDocument(supabase, document);
    }
    refreshDocuments(document.patient_id);
    return { success: "Document verification complete." };
  } catch {
    return { error: "Verification failed. Retry the original file upload if the object is missing. No document has been deleted." };
  }
}

export async function requestDocumentDownload(form: FormData): Promise<DocumentResult> {
  try {
    const { supabase, document } = await getClinicDocument(String(form.get("document_id") ?? ""));
    if (document.status !== "ready") return { error: "Resume verification before downloading this document" };
    const audit = await supabase.rpc("record_document_access_request", { p_document_id: document.id });
    if (audit.error) throw new Error("Access request could not be audited");
    const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET)
      .createSignedUrl(document.object_path, DOCUMENT_LINK_SECONDS, { download: true });
    if (error || !data?.signedUrl) throw new Error("Download link unavailable");
    return { signedUrl: data.signedUrl, expiresAt: Date.now() + DOCUMENT_LINK_SECONDS * 1000 };
  } catch {
    return { error: "Unable to prepare a private download. Refresh and try again." };
  }
}
