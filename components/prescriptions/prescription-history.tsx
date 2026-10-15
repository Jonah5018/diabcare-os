import Link from "next/link";
import ActionForm from "@/components/shared/action-form";
import { transitionPrescription } from "@/actions/prescription";
import { formatAppointmentDate } from "@/lib/clinic-date";
import type { PrescriptionHistoryRow } from "@/types/prescription";

export default function PrescriptionHistory({ rows, canUpdate, userId, administrator }: {
  rows: PrescriptionHistoryRow[];
  canUpdate: boolean;
  userId: string;
  administrator: boolean;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-slate-500">No prescriptions recorded.</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map(record => (
        <article key={record.id} className="space-y-4 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">{formatAppointmentDate(record.prescribed_date)}</h4>
              <p className="text-sm text-slate-500">Prescriber: {record.prescriber?.full_name ?? "Staff record unavailable"}</p>
              <Link href="#consultations"
                className="text-sm text-sky-700 underline">
                Review consultation history
              </Link>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize">{record.status}</span>
          </div>

          <ol className="space-y-3">
            {[...record.items].sort((left, right) => left.position - right.position).map(item => (
              <li key={item.id} className="space-y-2 rounded-xl bg-slate-50 p-4">
                <h5 className="break-words font-semibold">{item.position}. {item.medication_name} · {item.strength}</h5>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Dose</dt>
                    <dd className="break-words">{item.dose}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Frequency</dt>
                    <dd className="break-words">{item.frequency}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Route</dt>
                    <dd className="break-words">{item.route || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Duration</dt>
                    <dd className="break-words">{item.duration}</dd>
                  </div>
                </dl>
                {item.instructions ? <p className="whitespace-pre-wrap break-words text-sm">{item.instructions}</p> : null}
              </li>
            ))}
          </ol>

          {canUpdate && record.status === "active" && (administrator || record.prescriber_id === userId) ? (
            <ActionForm action={transitionPrescription} className="space-y-3">
              <input type="hidden" name="prescription_id" value={record.id} />
              <label htmlFor={`status-${record.id}`} className="block text-sm font-medium">Update status</label>
              <select id={`status-${record.id}`} name="status" className="w-full rounded-lg border p-3">
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <p className="text-xs text-slate-500">This is a terminal status. Medication items remain in history.</p>
              <button className="rounded-lg border px-4 py-2 text-sm font-medium">Save status</button>
            </ActionForm>
          ) : null}
        </article>
      ))}
    </div>
  );
}
