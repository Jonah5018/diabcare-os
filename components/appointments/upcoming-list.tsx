import { Ban, CalendarDays, Clock3, Stethoscope, UserRound } from "lucide-react";

import { cancelAppointment } from "@/actions/appointment";
import AppointmentStatusBadge from "@/components/appointments/appointment-status";
import { formatAppointmentDate, formatAppointmentTime } from "@/lib/clinic-date";
import type { AppointmentStatus } from "@/types/appointment";

export type UpcomingAppointment = {
  id: string;
  patientName: string;
  hospitalNumber: string;
  doctorName: string | null;
  appointmentDate: string;
  appointmentTime: string | null;
  reason: string | null;
  status: AppointmentStatus;
};

type UpcomingListProps = {
  canUpdate?: boolean;
  appointments: UpcomingAppointment[];
};

export default function UpcomingList({ appointments, canUpdate = true }: UpcomingListProps) {
  if (appointments.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <CalendarDays className="mx-auto h-9 w-9 text-slate-300" />
        <h2 className="mt-3 font-semibold text-slate-900">No upcoming appointments</h2>
        <p className="mt-1 text-sm text-slate-500">Future patient bookings will appear here.</p>
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">Upcoming Appointments</h2>
        <p className="mt-1 text-sm text-slate-500">Future scheduled patient visits.</p>
      </div>

      <div className="divide-y divide-slate-100">
        {appointments.map((appointment) => (
          <article key={appointment.id} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 break-words">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 font-semibold text-slate-900">{appointment.patientName}</h3>
                  <AppointmentStatusBadge status={appointment.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    {formatAppointmentDate(appointment.appointmentDate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4 shrink-0" />
                    {formatAppointmentTime(appointment.appointmentTime)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-4 w-4 shrink-0" />
                    {appointment.hospitalNumber}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Stethoscope className="h-4 w-4 shrink-0" />
                    {appointment.doctorName ?? "Doctor not assigned"}
                  </span>
                </div>

                {appointment.reason ? (
                  <p className="mt-3 text-sm text-slate-600">{appointment.reason}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center">
                {canUpdate ? <form action={cancelAppointment.bind(null, appointment.id)}>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                    <Ban className="h-4 w-4" />
                    Cancel
                  </button>
                </form> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
