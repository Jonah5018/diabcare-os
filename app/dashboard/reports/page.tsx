import Link from "next/link";
import PageHeader from "@/components/dashboard/page-header";
import AccessDenied from "@/components/shared/access-denied";
import OperationalSummary from "@/components/reports/operational-summary";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getOperationalReport } from "@/lib/reports/queries";
import { reportWindow } from "@/lib/reporting";
import { scalar, type SearchParams } from "@/lib/pagination";

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await getClinicContext();
  if (!can(profile.role, "reports:view")) return <AccessDenied />;
  const params = await searchParams;
  const period = reportWindow(scalar(params.from), scalar(params.to));
  if ("error" in period) {
    return (
      <section className="space-y-4">
        <PageHeader title="Reports" subtitle="Bounded clinic activity" />
        <p role="alert" className="text-rose-700">{period.error}</p>
        <Link href="/dashboard/reports" className="text-sky-700 underline">Reset report dates</Link>
      </section>
    );
  }
  const report = await getOperationalReport(period.from, period.to).catch(() => null);
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Clinic-scoped operational activity within at most 31 days" />
      <form className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-end" action="/dashboard/reports">
        <div>
          <label htmlFor="report-from" className="mb-2 block text-sm font-medium">From</label>
          <input id="report-from" name="from" type="date" defaultValue={period.from} required className="w-full rounded-xl border p-3" />
        </div>
        <div>
          <label htmlFor="report-to" className="mb-2 block text-sm font-medium">To</label>
          <input id="report-to" name="to" type="date" defaultValue={period.to} required className="w-full rounded-xl border p-3" />
        </div>
        <button className="rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white">Generate report</button>
      </form>
      <p className="text-sm text-slate-500">{period.from} to {period.to} · Africa/Lagos · Status/load figures reflect current saved state.</p>
      {report ? <OperationalSummary report={report} /> : <p role="alert" className="text-rose-700">Unable to load this report. Refresh to try again.</p>}
    </div>
  );
}
