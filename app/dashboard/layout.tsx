import DashboardShell from "@/components/dashboard/dashboard-shell";
import { getClinicContext } from "@/lib/auth/context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getClinicContext();
  const { data: clinic, error } = await supabase.from("organizations")
    .select("name").eq("id", profile.organization_id).single();
  if (error || !clinic) throw new Error("Unable to load your clinic workspace");

  return <DashboardShell account={{ fullName: profile.full_name, role: profile.role, clinicName: clinic.name }}>{children}</DashboardShell>;
}
