import PageHeader from "@/components/dashboard/page-header";
import StatCard from "@/components/dashboard/stat-card";
import { createClient } from "@/lib/supabase/server";

import {
  Building2,
  Users,
  Stethoscope,
  CalendarDays,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { count: organizations } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true });

  const { count: patients } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true });

  const { count: doctors } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role", "doctor");

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
          value={0}
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}