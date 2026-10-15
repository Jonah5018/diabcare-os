import Link from "next/link";
import { isOverduePlan } from "@/lib/clinical-review/trends";
import { formatAppointmentDate } from "@/lib/clinic-date";
import type { ClinicalReviewData } from "@/types/clinical-review";

export default function PlannedCare({ review }: { review: ClinicalReviewData }) {
  const path = `/dashboard/patients/${review.patient.id}`;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Recorded medication items</p>
        <h2 className="mt-2 text-lg font-semibold">Active prescriptions</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Current saved status; not evidence of dispensing or adherence. This item preview omits route, duration and instructions. Open the full prescription before use.
        </p>
        <div className="mt-5 space-y-3">
          {review.prescriptions.rows.map(row => (
            <details key={row.id} className="rounded-xl border border-slate-200 p-4">
              <summary className="min-h-11 cursor-pointer text-sm font-medium text-slate-800">
                Prescribed {formatAppointmentDate(row.prescribed_date)} · {row.items.length} items
              </summary>
              <ul className="mt-3 space-y-3">
                {[...row.items].sort((a, b) => a.position - b.position).map(item => (
                  <li key={item.id} className="border-t border-slate-100 pt-3 text-sm">
                    <p className="break-words font-medium">{item.medication_name} · {item.strength}</p>
                    <p className="mt-1 break-words text-xs leading-6 text-slate-500">Recorded dose: {item.dose}. Frequency: {item.frequency}.</p>
                    <p className="mt-1 break-all text-[10px] text-slate-500">Item source: {item.id}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 break-all text-[10px] text-slate-500">Source: prescriptions / {row.id}</p>
            </details>
          ))}
        </div>
        {!review.prescriptions.rows.length ? <p className="mt-5 text-sm text-slate-500">No active prescriptions recorded in this preview.</p> : null}
        {review.prescriptions.hasMore ? <p className="mt-4 text-xs text-slate-500">More active prescriptions exist.</p> : null}
        <Link
          href={`${path}#prescriptions`}
          prefetch={false}
          className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-sky-800"
        >
          Review full prescription history and instructions →
        </Link>
      </section>

      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Defined planning rule</p>
        <h2 className="mt-2 text-lg font-semibold">Planned follow-up review</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">Rule: a planned due date before today in Lagos is overdue. This does not prove a missed visit, contact attempt or clinical risk.</p>
        <ul className="mt-5 space-y-3">
          {review.followUps.rows.map(row => {
            const overdue = isOverduePlan(row, review.today);
            return (
              <li key={row.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">Due {formatAppointmentDate(row.due_date)}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${overdue ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {overdue ? "Rule-based flag: overdue plan" : "Recorded plan"}
                  </span>
                </div>
                <p className="mt-3 break-words text-sm leading-6 text-slate-600">{row.reason || "Reason not recorded"}</p>
                <p className="mt-3 break-all text-[10px] text-slate-500">Source: follow_ups / {row.id}</p>
              </li>
            );
          })}
        </ul>
        {!review.followUps.rows.length ? <p className="mt-5 text-sm text-slate-500">No planned follow-ups recorded.</p> : null}
        {review.followUps.hasMore ? <p className="mt-4 text-xs text-slate-500">More planned follow-ups exist; this is the earliest-date preview.</p> : null}
        <Link
          href={`${path}#follow-ups`}
          prefetch={false}
          className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-sky-800"
        >
          Review follow-up history →
        </Link>
      </section>
    </div>
  );
}
