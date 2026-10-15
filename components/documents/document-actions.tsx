"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { requestDocumentDownload, resumeDocument } from "@/actions/document";
import type { DocumentResult } from "@/types/document";

export default function DocumentActions({ id, ready, canResume }: { id: string; ready: boolean; canResume: boolean }) {
  const [state, dispatch, pending] = useActionState(async (_previous: DocumentResult, form: FormData) =>
    ready ? requestDocumentDownload(form) : resumeDocument(form), {});
  const [expiredAt, setExpiredAt] = useState<number | null>(null);

  useEffect(() => {
    if (!state.expiresAt) return;
    const expiry = state.expiresAt;
    const timer = setTimeout(() => setExpiredAt(expiry), Math.max(0, expiry - Date.now()));
    return () => clearTimeout(timer);
  }, [state.expiresAt]);

  if (!ready && !canResume) return <p className="text-sm text-slate-500">Awaiting verification by the uploader or a clinic administrator.</p>;

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50"
        onClick={() => {
          const form = new FormData();
          form.set("document_id", id);
          startTransition(() => dispatch(form));
        }}>
        {pending ? "Preparing..." : ready ? "Prepare private download" : "Resume verification"}
      </button>
      {state.signedUrl && state.expiresAt !== expiredAt ? (
        <p className="text-sm"><a href={state.signedUrl} rel="noreferrer" className="text-sky-700 underline">Download document</a> · Link expires after 60 seconds. Keep it private.</p>
      ) : state.signedUrl ? <p role="status" className="text-sm">Link expired. Prepare another private download.</p> : null}
      {state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-emerald-700">{state.success}</p> : null}
    </div>
  );
}
