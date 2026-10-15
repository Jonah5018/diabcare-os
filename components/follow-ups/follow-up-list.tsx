import Link from "next/link";
import ActionForm from "@/components/shared/action-form";
import { transitionFollowUp } from "@/actions/follow-up";
import { formatAppointmentDate } from "@/lib/clinic-date";
import type { FollowUpRow } from "@/types/follow-up";

export default function FollowUpList({ rows, today, userId, canUpdate = false, administrator = false }: {
  rows: FollowUpRow[];
  today: string;
  userId: string;
  canUpdate?: boolean;
  administrator?: boolean;
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">No follow-up plans on this page.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map(record => (
        <article key={record.id} className="min-w-0 space-y-3 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/dashboard/patients/${record.patient_id}#follow-ups`} className="font-semibold text-sky-700 underline">
                {record.patient ? `${record.patient.last_name} ${record.patient.first_name}` : "Review patient folder"}
              </Link>
              <p className="text-xs text-slate-500">{record.patient?.hospital_number ?? "Patient identity unavailable"}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize">{record.status}</span>
          </div>
          <p className="text-sm"><strong>Due:</strong> {formatAppointmentDate(record.due_date)}</p>
          {record.status === "planned" && record.due_date < today ? (
            <p className="text-sm font-medium text-amber-700">Overdue — review for recall</p>
          ) : null}
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{record.reason}</p>
          {record.consultation_id ? (
            <Link href={`/dashboard/patients/${record.patient_id}#consultations`} className="text-sm text-sky-700 underline">Review consultation history</Link>
          ) : null}
          {record.resolved_at ? <p className="text-xs text-slate-500">Resolved {new Date(record.resolved_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} (Lagos)</p> : null}

          {canUpdate && record.status === "planned" && (administrator || record.created_by === userId) ? (
            <ActionForm action={transitionFollowUp} className="space-y-3">
              <input type="hidden" name="follow_up_id" value={record.id} />
              <label htmlFor={`follow-up-status-${record.id}`} className="block text-sm font-medium">Resolve plan</label>
              <select id={`follow-up-status-${record.id}`} name="status" className="w-full rounded-xl border p-3">
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <p className="text-xs text-slate-500">Terminal status; the plan remains in patient history.</p>
              <button className="rounded-lg border px-4 py-2 text-sm font-medium">Save status</button>
            </ActionForm>
          ) : null}
        </article>
      ))}
    </div>
  );
}
