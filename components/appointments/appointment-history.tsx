import AppointmentStatusBadge from "@/components/appointments/appointment-status";
import { formatAppointmentDate, formatAppointmentTime } from "@/lib/clinic-date";
import type { AppointmentStatus } from "@/types/appointment";

export type PatientAppointment = {
  id: string;
  appointment_date: string;
  appointment_time: string | null;
  queue_number: number | null;
  reason: string | null;
  status: AppointmentStatus;
};

export default function AppointmentHistory({
  appointments,
}: {
  appointments: PatientAppointment[];
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">Appointment History</h3>

      {appointments.length === 0 ? (
        <p className="text-sm text-slate-500">No appointments recorded yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {appointments.map((appointment) => (
            <article key={appointment.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {formatAppointmentDate(appointment.appointment_date)}
                </p>
                <AppointmentStatusBadge status={appointment.status} />
              </div>

              <p className="text-sm text-slate-500">
                {formatAppointmentTime(appointment.appointment_time)}
                {appointment.queue_number ? ` · Queue #${appointment.queue_number}` : ""}
              </p>

              {appointment.reason ? (
                <p className="break-words text-sm text-slate-600">{appointment.reason}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
