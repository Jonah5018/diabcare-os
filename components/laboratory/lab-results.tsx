interface Lab {
  id: string;
  created_at: string;
  hba1c: number;
  creatinine: number;
  total_cholesterol: number;
  hdl: number;
  ldl: number;
  triglycerides: number;
  urine_protein: string;
  urine_glucose: string;
}

export default function LabResults({
  results,
}: {
  results: Lab[];
}) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
        No laboratory results available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((lab) => (
        <div key={lab.id} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-semibold">
              {new Date(lab.created_at).toLocaleDateString(
                "en-GB"
              )}
            </h4>

            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
              Laboratory
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Metric label="HbA1c" value={`${lab.hba1c}%`} />
            <Metric
              label="Creatinine"
              value={`${lab.creatinine} µmol/L`}
            />
            <Metric
              label="Total Cholesterol"
              value={`${lab.total_cholesterol} mmol/L`}
            />
            <Metric label="HDL" value={`${lab.hdl} mmol/L`} />
            <Metric label="LDL" value={`${lab.ldl} mmol/L`} />
            <Metric
              label="Triglycerides"
              value={`${lab.triglycerides} mmol/L`}
            />
            <Metric
              label="Urine Protein"
              value={lab.urine_protein}
            />
            <Metric
              label="Urine Glucose"
              value={lab.urine_glucose}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
