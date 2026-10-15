import PageHeader from "@/components/dashboard/page-header";
import { getPlatformOverview } from "@/lib/platform/queries";

export default async function PlatformOverview() {
  const metrics = await getPlatformOverview().catch(() => null);
  return (
    <div className="space-y-6">
      <PageHeader title="Platform Overview" subtitle="Global operational metadata; clinic clinical workflows remain isolated" />
      {metrics ? <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(metrics).map(([name, count]) => (
          <div key={name} className="rounded-2xl border bg-white p-5">
            <dt className="capitalize text-sm text-slate-500">{name.replaceAll("_", " ")}</dt>
            <dd className="mt-2 text-2xl font-semibold">{count.toLocaleString("en-GB")}</dd>
          </div>
        ))}
      </dl> : <p role="alert">Unable to load platform metrics.</p>}
      <p className="text-sm text-slate-600">This surface does not provide global patient records, clinic impersonation or membership switching.</p>
    </div>
  );
}
