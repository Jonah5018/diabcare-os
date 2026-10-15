import DocumentActions from "@/components/documents/document-actions";
import DocumentUpload from "@/components/documents/document-upload";
import type { ClinicalDocument } from "@/types/document";

export default function DocumentList({ rows, userId, canUpload, administrator }: {
  rows: ClinicalDocument[]; userId: string; canUpload: boolean; administrator: boolean;
}) {
  if (!rows.length) return <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">No patient documents recorded yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map(document => (
        <article key={document.id} className="space-y-3 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="break-words font-medium">{document.display_name}</h4>
              <p className="text-sm text-slate-500">{document.category} · {document.content_type} · {Math.ceil(document.size_bytes / 1024)} KiB</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{document.status === "ready" ? "Ready" : "Pending verification"}</span>
          </div>
          <time dateTime={document.created_at} className="block text-xs text-slate-500">
            {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(document.created_at))}
          </time>
          <DocumentActions id={document.id} ready={document.status === "ready"}
            canResume={canUpload && (document.uploaded_by === userId || administrator)} />
          {document.status === "pending" && canUpload && document.uploaded_by === userId ? (
            <details>
              <summary className="cursor-pointer text-sm text-sky-700">Retry an upload whose file was not stored</summary>
              <p className="my-3 text-sm text-slate-500">Select the same file with its original name. This reuses the existing reservation after a refresh.</p>
              <DocumentUpload patientId={document.patient_id} retry={{ requestId: document.request_id, category: document.category }} />
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
}
