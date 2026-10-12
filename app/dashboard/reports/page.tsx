import AccessDenied from "@/components/shared/access-denied";
import { can } from "@/lib/auth/permissions";
import { CalendarDays, CheckCircle2, Stethoscope, FlaskConical, HeartPulse, Ban, Users } from "lucide-react";
import PageHeader from "@/components/dashboard/page-header";
import StatCard from "@/components/dashboard/stat-card";
import { getClinicContext } from "@/lib/auth/context";
import { reportWindow } from "@/lib/reporting";
import { scalar, type SearchParams } from "@/lib/pagination";

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "reports:view")) return <AccessDenied />;
  const period = reportWindow(scalar(params.from), scalar(params.to));
  if ("error" in period) return <div className="space-y-4"><PageHeader title="Reports" subtitle="Clinic activity within a selected date range" /><p role="alert" className="rounded-xl border bg-white p-6 text-rose-700">{period.error}</p><a href="/dashboard/reports" className="text-sky-700 underline">Reset report dates</a></div>;

  const appointmentCount = (status?: string) => {
    let query = supabase.from("appointments").select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id).gte("appointment_date", period.from).lte("appointment_date", period.to);
    query = status ? query.eq("status", status) : query.neq("status", "cancelled");
    return query;
  };
  const clinicalCount = (table: string, dateColumn = "created_at") => supabase.from(table)
    .select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id)
    .gte(dateColumn, period.startTime).lt(dateColumn, period.endTime);
  const results = await Promise.all([
    appointmentCount(), appointmentCount("completed"), appointmentCount("cancelled"),
    clinicalCount("consultations", "visit_date"), clinicalCount("laboratory_results"), clinicalCount("vitals"), clinicalCount("patients"),
  ]);
  if (results.some(result => result.error)) throw new Error("Unable to load clinic reports");
  const metrics = [
    { title: "Appointments", icon: CalendarDays }, { title: "Completed Visits", icon: CheckCircle2 }, { title: "Cancelled Visits", icon: Ban },
    { title: "Consultation Records", icon: Stethoscope }, { title: "Laboratory Records", icon: FlaskConical }, { title: "Vitals Records", icon: HeartPulse }, { title: "New Patient Records", icon: Users },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Clinic activity within a selected date range" />
      <form action="/dashboard/reports" className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-end">
        <div><label htmlFor="report-from" className="mb-2 block text-sm font-medium">From</label><input id="report-from" type="date" name="from" defaultValue={period.from} required className="w-full rounded-xl border p-3" /></div>
        <div><label htmlFor="report-to" className="mb-2 block text-sm font-medium">To</label><input id="report-to" type="date" name="to" defaultValue={period.to} required className="w-full rounded-xl border p-3" /></div>
        <button className="rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white">Generate report</button>
      </form>
      <p className="text-sm text-slate-500">{period.from} to {period.to} · Clinic timezone: Africa/Lagos</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric, index) => <StatCard key={metric.title} title={metric.title} value={results[index].count ?? 0} icon={<metric.icon className="h-5 w-5" />} />)}</div>
      <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold text-slate-900">About these figures</h2><p className="mt-2 text-sm text-slate-600">Appointments excludes cancelled bookings. Completed visits counts appointment completion; consultation, laboratory, and vitals figures count saved records. These figures may differ when a visit has multiple records or clinical notes have not yet been saved.</p></section>
    </div>
  );
}
