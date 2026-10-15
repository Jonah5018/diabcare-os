import { Suspense } from "react";
import { CalendarDays, Clock3, RotateCcw, Users } from "lucide-react";
import PageHeader from "@/components/dashboard/page-header";
import StatCard from "@/components/dashboard/stat-card";
import WorkflowActions from "@/components/dashboard/workflow-actions";
import FollowUpOverview from "@/components/follow-ups/follow-up-overview";
import { getClinicContext } from "@/lib/auth/context";
import { formatAppointmentDate } from "@/lib/clinic-date";
import { getWorkspaceOverview } from "@/lib/workspace/overview";
import { workspaceGuidance } from "@/lib/workspace/navigation";

export default async function DashboardPage() {
  const { profile } = await getClinicContext();
  const overview = await getWorkspaceOverview();
  const guidance = workspaceGuidance[profile.role];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <PageHeader
          title="Clinic overview"
          eyebrow={guidance.label.toUpperCase()}
          subtitle={guidance.description}
        />
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold tracking-widest text-slate-500">CLINIC DAY · LAGOS</p>
          <time dateTime={overview.today} className="mt-1 block text-sm font-medium text-slate-800">
            {formatAppointmentDate(overview.today)}
          </time>
        </div>
      </div>

      <section aria-label="Current clinic counts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Patients" value={overview.patients} icon={<Users size={20} />} hint="Registered in this clinic" />
        <StatCard title="Today's Appointments" value={overview.appointments} icon={<CalendarDays size={20} />} hint="Today’s bookings, excluding cancellations" />
        <StatCard title="Waiting now" value={overview.waiting} icon={<Clock3 size={20} />} hint="Checked in and awaiting consultation today" />
        <StatCard title="Overdue follow-ups" value={overview.overdueFollowUps} icon={<RotateCcw size={20} />} hint="Planned reviews due before today" />
      </section>

      <WorkflowActions role={profile.role} />

      <Suspense fallback={
        <div role="status" className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          Loading follow-up overview…
        </div>
      }>
        <FollowUpOverview />
      </Suspense>
    </div>
  );
}
