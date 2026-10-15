import Link from "next/link";
import { TIMELINE_LABELS, type TimelineEvent } from "@/types/timeline";

const detailLabels: Record<string, string> = {
  scheduled_date: "Scheduled date",
  scheduled_time: "Scheduled time",
  current_status: "Current status",
  queue_number: "Queue number",
  systolic_bp: "Systolic BP (mmHg)",
  diastolic_bp: "Diastolic BP (mmHg)",
  bmi: "BMI (kg/m²)",
  chief_complaint: "Chief complaint preview",
  diagnosis: "Diagnosis preview",
  hba1c: "HbA1c (%)",
  creatinine: "Creatinine (µmol/L)",
  prescribed_date: "Prescribed date",
  due_date: "Follow-up due date",
};

function historySection(event: TimelineEvent): string {
  if (event.event_kind.startsWith("follow_up_")) return "follow-ups";
  if (event.event_kind.startsWith("appointment_")) return "appointments";
  if (event.event_kind.startsWith("prescription_")) return "prescriptions";
  if (event.event_kind === "vitals_recorded") return "vitals";
  if (event.event_kind === "laboratory_recorded") return "laboratory";
  return "consultations";
}

export default function TimelineList({ rows, patientId }: {
  rows: TimelineEvent[];
  patientId: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No recorded events on this timeline page.</p>;
  }

  return (
    <ol className="space-y-4">
      {rows.map(event => (
        <li key={`${event.event_kind}:${event.source_id}`} className="rounded-xl border bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h4 className="font-semibold text-slate-900">{TIMELINE_LABELS[event.event_kind]}</h4>
            {event.occurred_at ? (
              <time dateTime={event.occurred_at} className="text-sm text-slate-500">
                {new Date(event.occurred_at).toLocaleString("en-GB", {
                  timeZone: "Africa/Lagos",
                  dateStyle: "medium",
                  timeStyle: "short",
                })} (Lagos)
              </time>
            ) : <span className="text-sm text-slate-500">Time not recorded</span>}
          </div>

          {Object.keys(event.details).length ? (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {Object.entries(event.details).filter(([key]) => key in detailLabels).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-slate-500">{detailLabels[key]}</dt>
                  <dd className="break-words text-slate-800">
                    {value === null || value === ""
                      ? "Not recorded"
                      : key === "current_status" ? String(value).replaceAll("_", " ") : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-sky-700">
            <Link href={`#${historySection(event)}`} className="underline">Review module</Link>
            {event.appointment_id ? (
              <Link
                href={`/dashboard/patients/${patientId}?appointment=${event.appointment_id}#${historySection(event)}`}
                className="underline"
              >Review visit</Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
