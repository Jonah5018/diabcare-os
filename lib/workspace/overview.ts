import "server-only";

import { getClinicContext } from "@/lib/auth/context";
import { getClinicToday } from "@/lib/clinic-date";

export async function getWorkspaceOverview() {
  const { supabase, profile } = await getClinicContext();
  const today = getClinicToday();
  const clinic = profile.organization_id;
  const [patients, appointments, waiting, followUps] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true })
      .eq("organization_id", clinic),
    supabase.from("appointments").select("id", { count: "exact", head: true })
      .eq("organization_id", clinic).eq("appointment_date", today).neq("status", "cancelled"),
    supabase.from("appointments").select("id", { count: "exact", head: true })
      .eq("organization_id", clinic).eq("appointment_date", today).eq("status", "waiting"),
    supabase.from("follow_ups").select("id", { count: "exact", head: true })
      .eq("organization_id", clinic).eq("status", "planned").lt("due_date", today),
  ]);

  if ([patients, appointments, waiting, followUps].some(result => result.error || typeof result.count !== "number")) {
    throw new Error("Unable to load clinic dashboard counts");
  }

  return {
    today,
    patients: patients.count!,
    appointments: appointments.count!,
    waiting: waiting.count!,
    overdueFollowUps: followUps.count!,
  };
}
