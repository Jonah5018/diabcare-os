import PageHeader from "@/components/dashboard/page-header";
import StatCard from "@/components/dashboard/stat-card";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your clinic operations"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Organizations" value={1} />
        <StatCard title="Patients" value={1} />
        <StatCard title="Doctors" value={0} />
        <StatCard title="Appointments" value={0} />
      </div>
    </div>
  );
}