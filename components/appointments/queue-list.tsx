import Link from "next/link";
import { Ban, CheckCircle2, Clock3, LogIn, Stethoscope, UserRound } from "lucide-react";

import {
  cancelAppointment,
  checkInAppointment,
  completeAppointment,
  startConsultation,
} from "@/actions/appointment";
import AppointmentStatusBadge from "@/components/appointments/appointment-status";
import { formatAppointmentTime } from "@/lib/clinic-date";
import type { AppointmentStatus } from "@/types/appointment";

export type QueueAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  doctorName: string | null;
  appointmentTime: string | null;
  queueNumber: number | null;
  reason: string | null;
  status: AppointmentStatus;
};

type QueueListProps = {
  canUpdate?: boolean;
  appointments: QueueAppointment[];
};

export default function QueueList({ appointments, canUpdate = true }: QueueListProps) {
  if (appointments.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Clock3 className="mx-auto h-9 w-9 text-slate-300" />
        <h2 className="mt-3 font-semibold text-slate-900">No appointments today</h2>
        <p className="mt-1 text-sm text-slate-500">
          Today&apos;s booked patients and active queue will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Today&apos;s Appointments & Queue
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Check patients in and move them through the clinical workflow.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {appointments.map((appointment) => (
          <article key={appointment.id} className="grid gap-4 p-5 lg:grid-cols-[80px_minmax(0,1fr)_auto] lg:items-center">
            <div className="flex lg:block">
              <div className="flex h-14 min-w-14 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white">
                {appointment.queueNumber ? `#${appointment.queueNumber}` : "—"}
              </div>
            </div>

            <div className="min-w-0 break-words">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 font-semibold text-slate-900">
                  <Link href={`/dashboard/patients/${appointment.patientId}`} className="hover:text-sky-700 hover:underline">
                    {appointment.patientName}
                  </Link>
                </h3>
                <AppointmentStatusBadge status={appointment.status} />
              </div>

              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4 shrink-0" />
                  {appointment.hospitalNumber}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  {formatAppointmentTime(appointment.appointmentTime)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Stethoscope className="h-4 w-4 shrink-0" />
                  {appointment.doctorName ?? "Doctor not assigned"}
                </span>
              </div>

              {appointment.reason ? (
                <p className="mt-2 text-sm text-slate-600">{appointment.reason}</p>
              ) : null}

              {appointment.status === "waiting" || appointment.status === "in_consultation" ? (
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-sky-700">
                  <Link href={`/dashboard/patients/${appointment.patientId}?appointment=${appointment.id}#vitals`} className="hover:underline">
                    Record vitals
                  </Link>
                  <Link href={`/dashboard/patients/${appointment.patientId}?appointment=${appointment.id}#consultations`} className="hover:underline">
                    Clinical notes
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canUpdate && appointment.status === "scheduled" ? (
                <form action={checkInAppointment.bind(null, appointment.id)}>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600">
                    <LogIn className="h-4 w-4" />
                    Check In
                  </button>
                </form>
              ) : null}

              {canUpdate && appointment.status === "waiting" ? (
                <form action={startConsultation.bind(null, appointment.id)}>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
                    <Stethoscope className="h-4 w-4" />
                    Start Consultation
                  </button>
                </form>
              ) : null}

              {canUpdate && appointment.status === "in_consultation" ? (
                <form action={completeAppointment.bind(null, appointment.id)}>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Complete
                  </button>
                </form>
              ) : null}

              {canUpdate && appointment.status !== "completed" && appointment.status !== "cancelled" ? (
                <form action={cancelAppointment.bind(null, appointment.id)}>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                    <Ban className="h-4 w-4" />
                    Cancel
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
