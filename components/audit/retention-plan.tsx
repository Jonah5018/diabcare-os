import AdministrationForm from "@/components/onboarding/administration-form";
import { saveRetentionDraft } from "@/actions/audit";
import type { RetentionDraft } from "@/types/audit";

export default function RetentionPlan({ draft }: { draft: RetentionDraft }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Audit retention planning</h2>
      <p className="text-sm text-slate-600">Draft settings only. Automated deletion is disabled. A retention period needs clinic policy and legal review, archive and restore verification, and an approved implementation before enforcement.</p>
      <AdministrationForm action={saveRetentionDraft}>
        <label className="block space-y-1 text-sm">Proposed retention days (leave blank if undecided)
          <input name="days" type="number" min={1} max={36500} defaultValue={draft.retention_days ?? ""} className="w-full rounded-lg border p-2 sm:w-64" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="hold" type="checkbox" defaultChecked={draft.legal_hold} /> Proposed legal hold
        </label>
        <p className="text-sm text-slate-500">Archive required. Deletion disabled regardless of the draft hold setting.</p>
        <button className="rounded-lg bg-sky-600 px-4 py-2 text-white">Save retention draft</button>
      </AdministrationForm>
    </section>
  );
}
