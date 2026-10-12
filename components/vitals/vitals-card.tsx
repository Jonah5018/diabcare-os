import { HeartPulse, Scale, Thermometer } from "lucide-react";

interface Vital {
  systolic_bp: number;
  diastolic_bp: number;
  pulse: number;
  spo2?: number;
  temperature: number;
  weight: number;
  height: number;
  bmi: number;
  fasting_blood_sugar: number;
  random_blood_sugar: number;
  created_at: string;
}

export default function VitalsCard({
  vitals,
}: {
  vitals: Vital | null;
}) {
  if (!vitals) {
    return (
      <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
        No vitals recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Latest Vitals
        </h3>

        <span className="text-xs text-slate-500">
          {new Date(vitals.created_at).toLocaleDateString(
            "en-GB"
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          icon={<HeartPulse className="h-5 w-5 text-red-500" />}
          label="BP"
          value={`${vitals.systolic_bp}/${vitals.diastolic_bp}`}
        />

        <Metric
          icon={<HeartPulse className="h-5 w-5 text-sky-600" />}
          label="Pulse"
          value={`${vitals.pulse}`}
        />

        <Metric
          label="SpO₂"
          value={`${vitals.spo2}%`}
        />

        <Metric
          icon={<Thermometer className="h-5 w-5 text-orange-500" />}
          label="Temp"
          value={`${vitals.temperature}°`}
        />

        <Metric
          icon={<Scale className="h-5 w-5 text-emerald-600" />}
          label="BMI"
          value={`${vitals.bmi}`}
        />

        <Metric
          label="Weight"
          value={`${vitals.weight} kg`}
        />

        <Metric
          label="Height"
          value={`${vitals.height} cm`}
        />

        <Metric
          label="FBS"
          value={`${vitals.fasting_blood_sugar}`}
        />

        <Metric
          label="RBS"
          value={`${vitals.random_blood_sugar}`}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="text-xs text-slate-500">{label}</p>
      </div>

      <p className="font-bold text-slate-900">{value}</p>
    </div>
  );
}
