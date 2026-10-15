import Link from "next/link";
import AppointmentStatusBadge from "@/components/appointments/appointment-status";
import type { ClinicalReviewData } from "@/types/clinical-review";
import { formatAppointmentDate } from "@/lib/clinic-date";

export default function SourceRecords({ review }: { review: ClinicalReviewData }) {
  const path = `/dashboard/patients/${review.patient.id}`;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Recorded clinician entries</p>
        <h2 className="mt-2 text-lg font-semibold">Recently saved consultations</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">Text previews up to 200 characters. These are saved entries, not generated summaries.</p>
        <div className="mt-5 space-y-4">
          {review.consultations.rows.length ? review.consultations.rows.map(row => (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs text-slate-500">
                Visit date: {row.visit_date ? new Date(row.visit_date).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" }) : "Not recorded"}
              </p>
              <p className="mt-3 text-xs font-medium text-slate-500">Chief complaint</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-800">{row.chief_complaint || "Not recorded"}</p>
              <p className="mt-3 text-xs font-medium text-slate-500">Recorded diagnosis</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-800">{row.diagnosis || "Not recorded"}</p>
              <p className="mt-3 break-all text-[10px] text-slate-500">Source: consultations / {row.id}</p>
            </article>
          )) : <p className="text-sm text-slate-500">No consultations recorded in this preview.</p>}
        </div>
        {review.consultations.hasMore ? <p className="mt-4 text-xs text-slate-500">More consultation records exist.</p> : null}
        <Link
          href={`${path}#consultations`}
          prefetch={false}
          className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-sky-800"
        >
          Open consultation history →
        </Link>
      </section>

      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Recorded facts</p>
        <h2 className="mt-2 text-lg font-semibold">Recent appointment dates</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">Up to five bookings dated today or earlier. Saved status does not establish attendance or a missed visit.</p>
        <ul className="mt-5 space-y-4">
          {review.appointments.rows.map(row => (
            <li key={row.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">{formatAppointmentDate(row.appointment_date)}</p>
                <AppointmentStatusBadge status={row.status} />
              </div>
              <p className="break-all text-[10px] text-slate-500">Source: appointments / {row.id}</p>
            </li>
          ))}
        </ul>
        {!review.appointments.rows.length ? <p className="mt-5 text-sm text-slate-500">No appointments recorded in this date preview.</p> : null}
        {review.appointments.hasMore ? <p className="mt-4 text-xs text-slate-500">More appointment records exist.</p> : null}
        <Link
          href={`${path}#appointments`}
          prefetch={false}
          className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-sky-800"
        >
          Open appointment history →
        </Link>
      </section>
    </div>
  );
}
