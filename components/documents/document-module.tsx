import DocumentUpload from "@/components/documents/document-upload";
import DocumentList from "@/components/documents/document-list";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getDocumentHistory } from "@/lib/documents/queries";
import { encodeCursor } from "@/lib/pagination";

export default async function DocumentModule({ patientId, cursor, query }: {
  patientId: string; cursor: string; query: Record<string, string>;
}) {
  const { profile } = await getClinicContext();
  if (!can(profile.role, "documents:view")) return null;
  const history = await getDocumentHistory(patientId, cursor).catch(() => null);
  const last = history?.rows.at(-1);
  const canUpload = can(profile.role, "documents:upload");

  return (
    <section id="documents" className="scroll-mt-20 space-y-4 rounded-2xl border bg-slate-50 p-4 sm:p-6">
      <h3 className="text-lg font-semibold">Patient Documents</h3>
      {canUpload ? <DocumentUpload patientId={patientId} /> : null}
      {history ? (
        <>
          <DocumentList rows={history.rows} userId={profile.id} canUpload={canUpload}
            administrator={["platform_owner", "organization_admin"].includes(profile.role)} />
          <Pagination path={`/dashboard/patients/${patientId}`} query={query} parameter="documentCursor"
            hasMore={history.hasMore} cursor={last ? encodeCursor(last) : undefined} />
        </>
      ) : <p role="alert" className="text-sm text-rose-700">Unable to load document history. Refresh or clear its document cursor to try again.</p>}
    </section>
  );
}
