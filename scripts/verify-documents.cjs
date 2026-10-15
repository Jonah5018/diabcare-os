/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");
const { prepareDocument, documentChecksum, safeDocumentName } = load("lib/documents/file.ts");
const { DOCUMENT_MAX_BYTES } = load("lib/documents/config.ts");
const uuid = "12345678-1234-4234-8234-123456789abc";
const bytes = Buffer.from("%PDF-1.7\nsynthetic");
const document = { id: uuid, patient_id: uuid, organization_id: uuid, uploaded_by: uuid, request_id: uuid,
  display_name: "Synthetic.pdf", category: "clinical", content_type: "application/pdf", size_bytes: bytes.length,
  checksum: documentChecksum(bytes, "application/pdf"), object_path: `${uuid}/${uuid}/${uuid}.pdf`,
  status: "pending", created_at: "2026-10-14T08:00:00Z", updated_at: "2026-10-14T08:00:00Z" };
assert.equal(safeDocumentName("../../folder/Synthetic.pdf"), "Synthetic.pdf");
assert.equal(safeDocumentName("x\u0000<script>.pdf").includes("<"), false);
assert.throws(() => documentChecksum(Buffer.from("<html>"), "application/pdf"));
assert.throws(() => documentChecksum(Buffer.alloc(DOCUMENT_MAX_BYTES + 1), "application/pdf"));
assert.equal(documentChecksum(Buffer.from([137,80,78,71,13,10,26,10]), "image/png").length, 64);
assert.equal(documentChecksum(Buffer.from([255,216,255]), "image/jpeg").length, 64);

(async () => {
  const file = new File([bytes], "Synthetic.pdf", { type: "application/pdf" });
  assert.equal((await prepareDocument(file)).checksum, document.checksum);
  await assert.rejects(() => prepareDocument(new File([bytes], "unsafe.html", { type: "text/html" })));
  const calls = [];
  let role = "doctor";
  let uploadError = false;
  let auditError = false;
  const storage = {
    upload: async (path, body, options) => { calls.push(["upload", path, options]); return { error: uploadError ? {} : null }; },
    download: async () => ({ data: new Blob([bytes]), error: null }),
    createSignedUrl: async (...args) => { calls.push(["sign", ...args]); return { data: { signedUrl: "https://example.invalid/private?token=synthetic" }, error: null }; },
  };
  const supabase = { storage: { from: bucket => { assert.equal(bucket, "clinical-documents"); return storage; } },
    rpc: async (name, parameters) => { calls.push([name, parameters]); return { data: document, error: name === "record_document_access_request" && auditError ? {} : null }; } };
  const mocks = {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/context": { getClinicContext: async () => ({ supabase, profile: { id: uuid, role } }) },
    "@/lib/documents/queries": { getClinicDocument: async () => ({ supabase, profile: { id: uuid, role }, document: { ...document, status: "ready" } }) },
  };
  const actions = load("actions/document.ts", mocks);
  const form = new FormData();
  form.set("patient_id", uuid); form.set("request_id", uuid); form.set("category", "clinical"); form.set("file", file);
  form.set("organization_id", "forged"); form.set("uploaded_by", "forged"); form.set("object_path", "forged");
  assert.equal(Boolean((await actions.uploadDocument({}, form)).success), true);
  const reserve = calls.find(call => call[0] === "reserve_clinical_document")[1];
  assert.equal("p_organization_id" in reserve || "p_uploaded_by" in reserve || "p_object_path" in reserve, false);
  assert.equal(calls.find(call => call[0] === "upload")[2].upsert, false);
  uploadError = true;
  assert.equal(Boolean((await actions.uploadDocument({}, form)).success), true);
  role = "receptionist";
  const before = calls.length;
  assert.equal(Boolean((await actions.uploadDocument({}, form)).error), true);
  assert.equal(calls.length, before);
  await actions.requestDocumentDownload(new FormData());
  const sign = calls.find(call => call[0] === "sign");
  assert.equal(sign[2], 60); assert.equal(sign[3].download, true);
  assert.equal(calls.findIndex(call => call[0] === "record_document_access_request") < calls.findIndex(call => call[0] === "sign"), true);
  auditError = true;
  const signCount = calls.filter(call => call[0] === "sign").length;
  assert.equal(Boolean((await actions.requestDocumentDownload(new FormData())).error), true);
  assert.equal(calls.filter(call => call[0] === "sign").length, signCount);
  const List = load("components/documents/document-list.tsx", {
    "@/components/documents/document-actions": { __esModule: true, default: () => null },
    "@/components/documents/document-upload": { __esModule: true, default: () => null },
  }).default;
  const html = renderToStaticMarkup(React.createElement(List, { rows: [document], userId: uuid, canUpload: true, administrator: false }));
  assert.equal(html.includes("Pending verification"), true);
  assert.equal(html.includes("Retry an upload"), true);
  assert.equal(html.includes(document.object_path), false);
  const empty = renderToStaticMarkup(React.createElement(List, { rows: [], userId: uuid, canUpload: false, administrator: false }));
  assert.equal(empty.includes("No patient documents"), true);
  const historyCalls = [];
  const query = { then(resolve) { return Promise.resolve(resolve({ data: Array(26).fill(document), error: null })); } };
  for (const method of ["select", "eq", "order", "limit", "or"]) query[method] = (...args) => { historyCalls.push([method, ...args]); return query; };
  const history = load("lib/documents/queries.ts", {
    "@/lib/auth/context": { requirePermission: async permission => {
      assert.equal(permission, "documents:view");
      return { profile: { organization_id: uuid }, supabase: { from: () => query } };
    } },
  });
  const page = await history.getDocumentHistory(uuid, "");
  assert.equal(page.rows.length, 25); assert.equal(page.hasMore, true);
  assert.equal(historyCalls.some(call => call[0] === "limit" && call[1] === 26), true);
  assert.equal(historyCalls.some(call => call[0] === "eq" && call[1] === "patient_id"), true);
  assert.equal(historyCalls.some(call => call[0] === "eq" && call[1] === "organization_id"), true);
  await assert.rejects(() => history.getDocumentHistory(uuid, "invalid"));
  console.log("PASS: file size/MIME/signatures/checksum, safe names, server-derived reservation fields, no overwrite, upload retry, role denial, audited 60-second forced download, fail-closed signing and pending/empty UI.");
})().catch(error => { console.error(error); process.exitCode = 1; });
