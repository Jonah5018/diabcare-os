interface Props { bmi?: number | null; fbs?: number | null; rbs?: number | null; }

export default function DiabetesSummary({ bmi, fbs, rbs }: Props) {
  const readings = [["BMI", bmi, "kg/m²"], ["Fasting blood sugar", fbs, "mmol/L"], ["Random blood sugar", rbs, "mmol/L"]];
  return <section className="rounded-2xl border bg-gradient-to-r from-sky-600 to-cyan-500 p-6 text-white"><h3 className="text-lg font-semibold">Diabetes Clinical Summary</h3><p className="mt-1 text-sm text-sky-100">Latest recorded measurements</p><dl className="mt-5 grid gap-4 md:grid-cols-3">{readings.map(([label, value, unit]) => <div key={String(label)} className="rounded-xl bg-white/10 p-4"><dt className="text-xs text-sky-100">{label}</dt><dd className="mt-1 font-semibold">{value === null || value === undefined ? "Not recorded" : `${value} ${unit}`}</dd></div>)}</dl></section>;
}
