import PageHeader from "@/components/dashboard/page-header";
import { getOperationsSnapshot } from "@/lib/operations/queries";
import { operationalAlerts } from "@/lib/operations/alerts";
import { operationsStatus } from "@/lib/operations/security";

export default async function OperationsPage() {
  const metrics = await getOperationsSnapshot().catch(() => null);
  const configuration = operationsStatus();
  const alerts = metrics ? operationalAlerts(metrics) : [];
  return (
    <div className="space-y-6">
      <PageHeader title="Platform Operations" subtitle="Actionable queue and billing diagnostics without clinical content" />
      <section className="space-y-2 rounded-xl border bg-white p-5">
        <p>Automatic worker credentials: {configuration.automatic_worker_configured ? "Configured" : "Not configured"}</p>
        <p>Billing webhook switch: {configuration.billing_webhook_enabled ? "Enabled" : "Disabled"}</p>
        <p className="text-sm text-slate-500">Configuration indicators do not prove scheduler activity, provider delivery or database readiness. Public health checks measure liveness only.</p>
      </section>
      {metrics ? <>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(metrics).map(([name, value]) => <div key={name} className="rounded-xl border bg-white p-5"><dt className="capitalize text-sm">{name.replaceAll("_", " ")}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}
        </dl>
        <section className="space-y-3 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Operational attention</h2>
          {alerts.length ? alerts.map(alert => <p key={alert} role="status" className="text-sm text-amber-900">{alert}</p>) : <p className="text-sm text-slate-500">No queue or billing threshold is currently breached.</p>}
        </section>
      </> : <p role="alert">Unable to load operational diagnostics.</p>}
      <p className="text-sm text-slate-500">Authentication rejections and server faults emit redacted structured events. Configure log aggregation and alert routing separately; no fabricated authentication counter or external alert delivery is displayed.</p>
    </div>
  );
}
