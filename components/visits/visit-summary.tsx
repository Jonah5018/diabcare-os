import Link from "next/link";
import AppointmentStatusBadge from "@/components/appointments/appointment-status";
import { formatAppointmentDate } from "@/lib/clinic-date";
import { getVisitRecordCounts, type PatientVisit } from "@/lib/visits/context";

export default async function VisitSummary({ patientId, visit }: { patientId: string; visit: PatientVisit }) {
  const counts = await getVisitRecordCounts(patientId, visit.id);
  const modules = [
    { label: "Vitals records", anchor: "vitals" },
    { label: "Consultation records", anchor: "consultations" },
    { label: "Laboratory records", anchor: "laboratory" },
    { label: "Prescriptions", anchor: "prescriptions" },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Visit · {formatAppointmentDate(visit.appointment_date)}</h2>
        <AppointmentStatusBadge status={visit.status} />
      </div>
      {visit.queue_number ? <p className="text-sm">Queue #{visit.queue_number}</p> : null}
      {counts ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module, index) => (
            <div key={module.anchor} className="rounded-xl bg-white p-4">
              <dt><Link href={`#${module.anchor}`} className="text-sm text-sky-700 underline">{module.label}</Link></dt>
              <dd className="mt-1 text-lg font-semibold">{counts[index]}</dd>
            </div>
          ))}
        </dl>
      ) : <p role="alert" className="text-sm text-rose-700">Unable to load this visit&apos;s record counts.</p>}
      <p className="text-sm text-slate-600">
        New vitals, consultation and laboratory records use this visit. Prescriptions follow their selected consultation.
        History below remains longitudinal. Completing a visit does not imply that all clinical records have been saved.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/dashboard/appointments" className="text-sky-700 underline">Manage check-in and visit status</Link>
        <Link href={`/dashboard/patients/${patientId}`} className="text-sky-700 underline">Open folder without visit context</Link>
      </div>
    </section>
  );
}
