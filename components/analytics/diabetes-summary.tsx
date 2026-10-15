interface Props {
  bmi?: number | null;
  fbs?: number | null;
  rbs?: number | null;
}

export default function DiabetesSummary({ bmi, fbs, rbs }: Props) {
  const readings = [
    { label: "BMI", value: bmi, unit: "kg/m²" },
    { label: "Fasting blood sugar", value: fbs, unit: "mmol/L" },
    { label: "Random blood sugar", value: rbs, unit: "mmol/L" },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-[linear-gradient(120deg,#173349,#0e2033)] p-5 text-white sm:p-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">Patient record</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">Latest recorded measurements</h3>
      <p className="mt-1 text-xs leading-6 text-slate-300">Values from the latest vitals entry; no clinical interpretation is inferred.</p>
      <dl className="mt-5 grid gap-3 md:grid-cols-3">
        {readings.map(reading => (
          <div key={reading.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <dt className="text-xs text-slate-300">{reading.label}</dt>
            <dd className="mt-2 text-lg font-medium tabular-nums">
              {reading.value === null || reading.value === undefined ? "Not recorded" : `${reading.value} ${reading.unit}`}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
