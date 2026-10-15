"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { uploadDocument } from "@/actions/document";
import { documentCategories } from "@/lib/documents/config";
import type { DocumentResult } from "@/types/document";

type RetryUpload = { requestId: string; category: string };

export default function DocumentUpload({ patientId, retry }: { patientId: string; retry?: RetryUpload }) {
  const [attempt, setAttempt] = useState(0);
  return <UploadForm key={attempt} patientId={patientId} retry={retry} onAnother={() => setAttempt(value => value + 1)} />;
}

function UploadForm({ patientId, retry, onAnother }: { patientId: string; retry?: RetryUpload; onAnother: () => void }) {
  const [state, dispatch, pending] = useActionState<DocumentResult, FormData>(uploadDocument, {});
  const requestId = useRef<string | null>(null);

  if (state.success) return (
    <div className="space-y-3 rounded-xl border bg-white p-5">
      <p role="status" className="text-emerald-700">{state.success}</p>
      {!retry ? <button type="button" onClick={onAnother} className="rounded-lg border px-4 py-2">Upload another document</button> : null}
    </div>
  );

  return (
    <form aria-busy={pending} className="space-y-4 rounded-xl border bg-white p-5"
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        requestId.current ??= crypto.randomUUID();
        form.set("request_id", retry?.requestId ?? requestId.current);
        if (retry) form.set("category", retry.category);
        form.set("patient_id", patientId);
        startTransition(() => dispatch(form));
      }}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <legend className="mb-3 font-semibold">{retry ? "Retry this pending upload with the original file" : "Upload a patient document"}</legend>
        <label className="block space-y-1 text-sm">Category
          <select name="category" defaultValue={retry?.category ?? "clinical"} disabled={Boolean(retry)} className="w-full rounded-lg border p-2 sm:w-64"
            onChange={() => { requestId.current = null; }}>
            {documentCategories.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-sm">File (PDF, PNG or JPEG, up to 768 KiB)
          <input name="file" type="file" required accept="application/pdf,image/png,image/jpeg"
            className="w-full rounded-lg border p-2" onChange={() => { requestId.current = null; }} />
        </label>
        <p className="text-sm text-slate-500">Use a neutral filename. Private storage checks type and size; file signatures are checked by the application. Files are not malware-scanned. No document is published or sent to anyone.</p>
        <button className="rounded-lg bg-sky-600 px-4 py-2 text-white">Upload document</button>
      </fieldset>
      {pending ? <p role="status" className="text-sm">Uploading and verifying...</p> : null}
      {state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}</p> : null}
    </form>
  );
}
