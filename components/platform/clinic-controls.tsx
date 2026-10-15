import AdministrationForm from "@/components/onboarding/administration-form";
import { bindClinicBilling, setClinicStatus } from "@/actions/platform";

export default function ClinicControls({ id, status, bindingConfigured }: {
  id: string; status: "active" | "suspended"; bindingConfigured: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Clinic operational access</h2>
        <p className="text-sm text-slate-600">Suspension blocks clinic workflows and document access without deleting records. Platform owners retain this separate administration surface to restore access.</p>
        <AdministrationForm key={status} action={setClinicStatus}>
          <input name="clinic_id" type="hidden" value={id} />
          <input name="expected" type="hidden" value={status} />
          <input name="status" type="hidden" value={status === "active" ? "suspended" : "active"} />
          <label className="block text-sm">Reason
            <select name="reason" required className="mt-1 w-full rounded-lg border p-2">
              <option value="operational_review">Operational review</option>
              <option value="security_review">Security review</option>
              <option value="clinic_request">Clinic request</option>
              <option value="resolved">Issue resolved</option>
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required /> I understand the effect on clinic access.</label>
          <button className={`rounded-lg px-4 py-2 text-white ${status === "active" ? "bg-rose-700" : "bg-sky-600"}`}>
            {status === "active" ? "Suspend clinic access" : "Restore clinic access"}
          </button>
        </AdministrationForm>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Trusted billing account binding</h2>
        {bindingConfigured ? <p className="rounded-xl border bg-white p-5">Provider account binding exists. Reassignment requires a separately reviewed migration.</p> : (
          <AdministrationForm action={bindClinicBilling}>
            <input name="clinic_id" type="hidden" value={id} />
            <p className="text-sm text-slate-600">Use identifiers verified in the provider dashboard. This binds an existing Stripe subscription; it does not start checkout, charge money or grant paid status.</p>
            <label className="block text-sm">Customer ID<input name="customer" required maxLength={184} placeholder="cus_..." className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="block text-sm">Subscription ID<input name="subscription" required maxLength={184} placeholder="sub_..." className="mt-1 w-full rounded-lg border p-2" /></label>
            <button className="rounded-lg bg-sky-600 px-4 py-2 text-white">Bind existing provider account</button>
          </AdministrationForm>
        )}
      </section>
    </div>
  );
}
