export const DOCUMENT_BUCKET = "clinical-documents";
export const DOCUMENT_MAX_BYTES = 768 * 1024;
export const DOCUMENT_LINK_SECONDS = 60;
export const documentTypes = ["application/pdf", "image/png", "image/jpeg"] as const;
export const documentCategories = ["clinical", "laboratory", "referral", "legacy"] as const;
