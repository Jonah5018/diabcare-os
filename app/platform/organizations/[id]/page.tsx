import PageHeader from "@/components/dashboard/page-header";
import ClinicControls from "@/components/platform/clinic-controls";
import { getPlatformClinic } from "@/lib/platform/queries";

export default async function PlatformClinicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clinic = await getPlatformClinic(id).catch(() => null);
  if (!clinic) return <p role="alert">Clinic administration details are unavailable.</p>;
  return (
    <div className="space-y-6">
      <PageHeader title={clinic.name} subtitle="Global clinic controls and aggregate support metadata" />
      <div className="rounded-2xl border bg-white p-6">
        <p>Operational status: {clinic.operational_status}</p>
        <p>Subscription: {clinic.subscription_status ?? "Not configured"} · Plan: {clinic.plan_id ?? "Not configured"}</p>
        <p>Staff profiles: {clinic.staff_count} · Patient records: {clinic.patient_count}</p>
      </div>
      <ClinicControls id={clinic.id} status={clinic.operational_status} bindingConfigured={clinic.binding_configured} />
    </div>
  );
}
