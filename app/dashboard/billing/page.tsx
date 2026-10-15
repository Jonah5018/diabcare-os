import PageHeader from "@/components/dashboard/page-header";
import AccessDenied from "@/components/shared/access-denied";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClinicEntitlements } from "@/lib/billing/entitlements";

export default async function BillingPage() {
  const { profile } = await getClinicContext();
  if (!can(profile.role, "billing:view")) return <AccessDenied />;
  const result = await getClinicEntitlements().catch(() => null);
  if (!result) return <p role="alert">Unable to load clinic billing configuration.</p>;
  const subscription = result.subscription;

  return (
    <div className="space-y-6">
      <PageHeader title="Clinic Billing" subtitle="Trusted subscription state and centralized entitlements" />
      <section className="space-y-3 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold">{subscription ? subscription.plan : "Billing not configured"}</h2>
        <p>Status: {subscription?.status ?? "Unmanaged existing clinic access"}</p>
        <p className="text-sm text-slate-500">Subscription state comes from verified provider events. No payment, paid subscription or checkout is claimed by this page.</p>
        <p className="text-sm">Staff limit: {subscription?.staff_limit ?? "Not configured"} · Patient limit: {subscription?.patient_limit ?? "Not configured"}</p>
        <p className="text-sm text-slate-500">Limit fields are reserved for approved future quota enforcement. Core clinical recording and access to existing records are retained.</p>
      </section>
      <dl className="grid gap-4 sm:grid-cols-3">
        {Object.entries(result.features).map(([feature, enabled]) => (
          <div key={feature} className="rounded-xl border bg-white p-5">
            <dt className="capitalize">{feature.replaceAll("_", " ")}</dt>
            <dd className="mt-2 font-medium">{enabled ? "Available, subject to staff capability" : "Unavailable"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
