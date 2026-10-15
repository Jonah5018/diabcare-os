import Link from "next/link";
import AccessDenied from "@/components/shared/access-denied";
import PageHeader from "@/components/dashboard/page-header";
import EmptyState from "@/components/shared/empty-state";
import Pagination from "@/components/shared/pagination";
import AuditFilterForm from "@/components/audit/audit-filters";
import AuditEvents from "@/components/audit/audit-events";
import AuditExport from "@/components/audit/audit-export";
import RetentionPlan from "@/components/audit/retention-plan";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { auditFilters, auditQuery } from "@/lib/audit/filters";
import { getAuditPage, getRetentionDraft } from "@/lib/audit/queries";
import { encodeCursor, type SearchParams } from "@/lib/pagination";

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await getClinicContext();
  if (!can(profile.role, "team:view")) return <AccessDenied />;
  const params = await searchParams;
  let filters;
  try {
    filters = auditFilters(params);
  } catch {
    return <div role="alert" className="space-y-3"><p>Invalid audit filters. Choose valid IDs and a date range of up to 31 days.</p><Link href="/dashboard/audit" className="text-sky-700 underline">Reset filters</Link></div>;
  }
  const [page, draft] = await Promise.all([
    getAuditPage(filters).catch(() => null), getRetentionDraft().catch(() => null),
  ]);
  const query = auditQuery(filters);
  const last = page?.rows.at(-1);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit History" subtitle="Clinical and administration changes within your clinic" />
      <p className="text-sm text-slate-500">Events start when auditing was enabled. Notes, measurements, contacts and invitation secrets are excluded. Select appointments and a record ID to inspect its recorded status transitions.</p>
      <AuditFilterForm filters={filters} />
      {can(profile.role, "audit:export") ? <AuditExport key={JSON.stringify({ query, cursor: filters.cursor })} query={query} cursor={filters.cursor} /> : null}
      {page ? (
        <>
          {page.rows.length ? <AuditEvents rows={page.rows} query={query} /> : <EmptyState title="No matching audit events" description="Change the filters or date window to look for other recorded changes." />}
          <Pagination path="/dashboard/audit" query={query} hasMore={page.hasMore} cursor={last ? encodeCursor(last) : undefined} />
        </>
      ) : <p role="alert" className="text-rose-700">Unable to load audit history. Refresh and try again.</p>}
      {draft ? <RetentionPlan draft={draft} /> : <p role="alert">Unable to load the retention draft.</p>}
    </div>
  );
}
