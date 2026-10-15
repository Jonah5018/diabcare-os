import "server-only";

import { createHash } from "node:crypto";
import { DOCUMENT_MAX_BYTES, documentTypes } from "@/lib/documents/config";

export function safeDocumentName(name: string) {
  const basename = name.split(/[\\/]/).at(-1) ?? "";
  return basename.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(0, 160).trim() || "Clinical document";
}

export function documentChecksum(bytes: Uint8Array, type: string) {
  if (bytes.length < 1 || bytes.length > DOCUMENT_MAX_BYTES) throw new Error("Document must be 1 byte to 768 KiB");
  const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const valid = type === "application/pdf" ? starts([37, 80, 68, 70, 45])
    : type === "image/png" ? starts([137, 80, 78, 71, 13, 10, 26, 10])
    : type === "image/jpeg" && starts([255, 216, 255]);
  if (!valid) throw new Error("File bytes do not match an allowed PDF, PNG or JPEG signature");
  return createHash("sha256").update(bytes).digest("hex");
}

export async function prepareDocument(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !documentTypes.includes(file.type as typeof documentTypes[number])) {
    throw new Error("Choose a PDF, PNG or JPEG file");
  }
  if (file.size < 1 || file.size > DOCUMENT_MAX_BYTES) throw new Error("Document must be 1 byte to 768 KiB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, checksum: documentChecksum(bytes, file.type), contentType: file.type,
    size: bytes.length, name: safeDocumentName(file.name) };
}
