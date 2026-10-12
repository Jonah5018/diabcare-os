import Link from "next/link";
import { CalendarCheck2, CheckCircle2, Clock3, Stethoscope } from "lucide-react";

import AppointmentForm from "@/components/appointments/appointment-form";
import QueueList, { type QueueAppointment } from "@/components/appointments/queue-list";
import UpcomingList, { type UpcomingAppointment } from "@/components/appointments/upcoming-list";
import PageHeader from "@/components/dashboard/page-header";
import { getClinicToday } from "@/lib/clinic-date";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { scalar, PAGE_SIZE, type SearchParams } from "@/lib/pagination";
import { patientName, relation, type PatientIdentity } from "@/lib/patient-display";
import type { AppointmentStatus } from "@/types/appointment";

type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_date: string;
  appointment_time: string | null;
  queue_number: number | null;
  reason: string | null;
  status: AppointmentStatus;
  patient: PatientIdentity | null;
  doctor: { full_name: string } | null;
};

export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = (key: string) => { const value = Number(scalar(params[key])); return Number.isSafeInteger(value) && value > 0 && value <= 100000 ? value : 1; };
  const queuePage = page("queuePage"), futurePage = page("futurePage");
  const { supabase, profile } = await getClinicContext();
  const clinicToday = getClinicToday();

  const statsPromise = Promise.all(["scheduled", "waiting", "in_consultation", "completed"].map(status => supabase.from("appointments").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("appointment_date", clinicToday).eq("status", status)));

  const [
    { data: patients, error: patientsError },
    { data: doctors, error: doctorsError },
    { data: todayAppointments, error: todayAppointmentsError },
    { data: upcomingAppointments, error: upcomingAppointmentsError },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id, hospital_number, first_name, other_names, last_name")
      .eq("organization_id", profile.organization_id)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }).limit(20),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("organization_id", profile.organization_id)
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name", { ascending: true }).limit(20),
    supabase
      .from("appointments")
      .select("id, patient_id, doctor_id, appointment_date, appointment_time, queue_number, reason, status, patient:patients!appointments_patient_id_fkey(first_name, other_names, last_name, hospital_number), doctor:users!appointments_doctor_id_fkey(full_name)")
      .eq("organization_id", profile.organization_id)
      .eq("appointment_date", clinicToday)
      .order("queue_number", { ascending: true, nullsFirst: false })
      .order("appointment_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range((queuePage - 1) * PAGE_SIZE, queuePage * PAGE_SIZE),
    supabase
      .from("appointments")
      .select("id, patient_id, doctor_id, appointment_date, appointment_time, queue_number, reason, status, patient:patients!appointments_patient_id_fkey(first_name, other_names, last_name, hospital_number), doctor:users!appointments_doctor_id_fkey(full_name)")
      .eq("organization_id", profile.organization_id)
      .gt("appointment_date", clinicToday)
      .eq("status", "scheduled")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true, nullsFirst: false }).order("id", { ascending: true }).range((futurePage - 1) * PAGE_SIZE, futurePage * PAGE_SIZE),
  ]);

  if (patientsError || doctorsError || todayAppointmentsError || upcomingAppointmentsError) {
    throw new Error("Unable to load the clinic's appointments");
  }

  const statusCounts = await statsPromise;
  if (statusCounts.some(result => result.error)) throw new Error("Unable to load queue counters");
  const queueHasMore = (todayAppointments?.length ?? 0) > PAGE_SIZE;
  const futureHasMore = (upcomingAppointments?.length ?? 0) > PAGE_SIZE;
  const queueAppointments: QueueAppointment[] = (
    (todayAppointments ?? []).slice(0, PAGE_SIZE) as unknown as AppointmentRow[]
  ).map((appointment) => ({
    id: appointment.id,
    patientId: appointment.patient_id,
    patientName: patientName(relation(appointment.patient)),
    hospitalNumber: relation(appointment.patient)?.hospital_number ?? "—",
    doctorName: appointment.doctor_id
      ? relation(appointment.doctor)?.full_name ?? "Assigned doctor"
      : null,
    appointmentTime: appointment.appointment_time,
    queueNumber: appointment.queue_number,
    reason: appointment.reason,
    status: appointment.status,
  }));

  const futureAppointments: UpcomingAppointment[] = (
    (upcomingAppointments ?? []).slice(0, PAGE_SIZE) as unknown as AppointmentRow[]
  ).map((appointment) => ({
    id: appointment.id,
    patientName: patientName(relation(appointment.patient)),
    hospitalNumber: relation(appointment.patient)?.hospital_number ?? "—",
    doctorName: appointment.doctor_id
      ? relation(appointment.doctor)?.full_name ?? "Assigned doctor"
      : null,
    appointmentDate: appointment.appointment_date,
    appointmentTime: appointment.appointment_time,
    reason: appointment.reason,
    status: appointment.status,
  }));

  const statCards = [
    { label: "Scheduled", status: "scheduled", icon: CalendarCheck2 },
    { label: "Waiting", status: "waiting", icon: Clock3 },
    { label: "In Consultation", status: "in_consultation", icon: Stethoscope },
    { label: "Completed", status: "completed", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Appointments"
        subtitle="Manage bookings, patient check-in, and today's clinical queue"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          const count = statusCounts[index].count ?? 0;

          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{count}</p>
                </div>
                <div className="rounded-xl bg-sky-50 p-3 text-sky-700">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        {can(profile.role, "appointments:create") ? <AppointmentForm patients={patients ?? []} doctors={doctors ?? []} clinicToday={clinicToday} /> : null}
        <div className="min-w-0 space-y-4"><QueueList appointments={queueAppointments} canUpdate={can(profile.role, "appointments:update")} /><nav aria-label="Queue pages" className="flex flex-wrap gap-3 text-sm">{queuePage > 1 ? <Link href={`?queuePage=${queuePage - 1}&futurePage=${futurePage}`} className="rounded-lg border bg-white px-4 py-2">Previous queue page</Link> : null}{queueHasMore ? <Link href={`?queuePage=${queuePage + 1}&futurePage=${futurePage}`} className="rounded-lg border bg-white px-4 py-2">Next queue page</Link> : null}</nav></div>
      </div>

      <UpcomingList appointments={futureAppointments} canUpdate={can(profile.role, "appointments:update")} /><nav aria-label="Upcoming appointment pages" className="flex flex-wrap gap-3 text-sm">{futurePage > 1 ? <Link href={`?queuePage=${queuePage}&futurePage=${futurePage - 1}`} className="rounded-lg border bg-white px-4 py-2">Previous upcoming page</Link> : null}{futureHasMore ? <Link href={`?queuePage=${queuePage}&futurePage=${futurePage + 1}`} className="rounded-lg border bg-white px-4 py-2">Next upcoming page</Link> : null}</nav>
    </div>
  );
}
