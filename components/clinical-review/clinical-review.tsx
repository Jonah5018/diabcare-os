import TrendCard from "@/components/clinical-review/trend-card";
import SourceRecords from "@/components/clinical-review/source-records";
import PlannedCare from "@/components/clinical-review/planned-care";
import MeasurementHistory from "@/components/clinical-review/measurement-history";
import type { ClinicalReviewData } from "@/types/clinical-review";

export default function ClinicalReview({ review }: { review: ClinicalReviewData }) {
  const vitalPoints = (field: "weight" | "fasting_blood_sugar") => review.vitals.rows.map(row => ({
    sourceId: row.id,
    recordedAt: row.created_at,
    value: row[field],
  }));
  const laboratoryPoints = review.laboratories.rows.map(row => ({
    sourceId: row.id,
    recordedAt: row.created_at,
    value: row.hba1c,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-[linear-gradient(120deg,#173349,#0e2033)] p-5 text-white sm:p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">Clinician support / bounded record preview</p>
        <h2 className="mt-3 text-lg font-semibold">A clearer view of the recorded journey.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
          Recorded facts, arithmetic changes and defined planning flags are shown separately. Source records remain authoritative. No automated diagnosis, prescribing or treatment recommendation is generated.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-slate-300">
          {["Recorded fact", "Calculated value", "Rule-based flag", "Clinician entry"].map(label => (
            <span key={label} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">{label}</span>
          ))}
        </div>
        <p className="mt-4 text-xs leading-6 text-slate-300">
          AI-generated suggestions are disabled. Clinical decisions remain with the treating clinician.
        </p>
      </section>

      <section aria-label="Recorded measurement trends" className="grid gap-4 xl:grid-cols-3">
        <TrendCard title="Weight" unit="kg" points={vitalPoints("weight")} />
        <TrendCard title="Fasting glucose" unit="mmol/L" points={vitalPoints("fasting_blood_sugar")} />
        <TrendCard title="HbA1c" unit="%" changeUnit="percentage points" points={laboratoryPoints} />
      </section>

      <MeasurementHistory review={review} />
      <SourceRecords review={review} />
      <PlannedCare review={review} />
      <p className="text-xs leading-7 text-slate-500">
        This preview is not the complete patient record. Review the full histories and confirm missing information before making a clinical decision.
      </p>
    </div>
  );
}
