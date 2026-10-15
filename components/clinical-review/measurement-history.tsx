import type { ClinicalReviewData } from "@/types/clinical-review";

function recorded(value: number | null, unit = "") {
  return value === null ? "Not recorded" : `${value}${unit ? ` ${unit}` : ""}`;
}

function RecordedDate({ value }: { value: string | null }) {
  if (!value) return <>Date not recorded</>;

  return (
    <time dateTime={value}>
      {new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}
    </time>
  );
}

export default function MeasurementHistory({ review }: { review: ClinicalReviewData }) {
  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Recorded facts / source history</p>
      <h2 className="mt-2 text-lg font-semibold">Measurement source records</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">Up to twelve entries per source. Missing dates/values are preserved; chart omission does not remove the record.</p>

      <details className="mt-5 border-t border-slate-100 pt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-sky-800">Review vitals source records</summary>
        {review.vitals.rows.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Recorded vitals, measurement units and source identifiers</caption>
              <thead>
                <tr>
                  {["Recorded date (Lagos)", "Weight", "BP", "Fasting glucose", "Random glucose", "Source ID"].map(label => (
                    <th key={label} scope="col" className="px-2 py-3">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {review.vitals.rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-2 py-3"><RecordedDate value={row.created_at} /></td>
                    <td className="px-2 py-3 tabular-nums">{recorded(row.weight, "kg")}</td>
                    <td className="px-2 py-3 tabular-nums">
                      {recorded(row.systolic_bp)} / {recorded(row.diastolic_bp)} mmHg
                    </td>
                    <td className="px-2 py-3 tabular-nums">{recorded(row.fasting_blood_sugar, "mmol/L")}</td>
                    <td className="px-2 py-3 tabular-nums">{recorded(row.random_blood_sugar, "mmol/L")}</td>
                    <td className="px-2 py-3"><code className="text-[10px]">{row.id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-slate-500">Vitals not recorded.</p>}
        {review.vitals.hasMore ? <p className="mt-3 text-xs text-slate-500">Older vitals exist beyond this preview.</p> : null}
      </details>

      <details className="mt-5 border-t border-slate-100 pt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-sky-800">Review laboratory source records</summary>
        {review.laboratories.rows.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Recorded laboratory measurements and source identifiers</caption>
              <thead>
                <tr>
                  {["Recorded date (Lagos)", "HbA1c", "Creatinine", "Source ID"].map(label => (
                    <th key={label} scope="col" className="px-2 py-3">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {review.laboratories.rows.map(row => (
                  <tr key={row.id}>
                    <td className="px-2 py-3"><RecordedDate value={row.created_at} /></td>
                    <td className="px-2 py-3 tabular-nums">{recorded(row.hba1c, "%")}</td>
                    <td className="px-2 py-3 tabular-nums">{recorded(row.creatinine, "µmol/L")}</td>
                    <td className="px-2 py-3"><code className="text-[10px]">{row.id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-slate-500">Laboratory measurements not recorded.</p>}
        {review.laboratories.hasMore ? <p className="mt-3 text-xs text-slate-500">Older laboratory records exist beyond this preview.</p> : null}
      </details>
    </section>
  );
}
