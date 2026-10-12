import Link from "next/link";

import PageHeader from "@/components/dashboard/page-header";
import StatCard from "@/components/dashboard/stat-card";
import { getClinicToday } from "@/lib/clinic-date";
import { getClinicContext } from "@/lib/auth/context";

import {
  Building2,
  Users,
  Stethoscope,
  CalendarDays,
} from "lucide-react";

export default async function DashboardPage() {
  const { supabase, profile } = await getClinicContext();

  const [organizationResult, patientResult, doctorResult, appointmentResult] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("id", profile.organization_id),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("role", "doctor").eq("is_active", true),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("appointment_date", getClinicToday()).neq("status", "cancelled"),
  ]);
  if ([organizationResult, patientResult, doctorResult, appointmentResult].some(result => result.error)) throw new Error("Unable to load clinic dashboard counts");
  const organizations = organizationResult.count, patients = patientResult.count, doctors = doctorResult.count, todayAppointments = appointmentResult.count;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your clinic operations"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Organizations"
          value={organizations ?? 0}
          icon={<Building2 className="h-5 w-5" />}
        />

        <StatCard
          title="Patients"
          value={patients ?? 0}
          icon={<Users className="h-5 w-5" />}
        />

        <StatCard
          title="Doctors"
          value={doctors ?? 0}
          icon={<Stethoscope className="h-5 w-5" />}
        />

        <StatCard
          title="Today's Appointments"
          value={todayAppointments ?? 0}
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>
      <section className="space-y-4"><h2 className="text-lg font-semibold text-slate-900">Continue the clinic workflow</h2><div className="grid gap-4 md:grid-cols-3">{[
        { title: "Patient folders", text: "Find a patient and review their care history.", href: "/dashboard/patients" },
        { title: "Today's clinic queue", text: "Check patients in and coordinate their visits.", href: "/dashboard/appointments" },
        { title: "Clinical records", text: "Review consultation notes across your clinic.", href: "/dashboard/consultations" },
      ].map(item => <Link key={item.href} href={item.href} className="rounded-2xl border bg-white p-6 transition hover:border-sky-300"><h3 className="font-semibold text-sky-700">{item.title}</h3><p className="mt-2 text-sm text-slate-500">{item.text}</p></Link>)}</div></section>
    </div>
  );
}
