import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, roleLabels, type Permission, type UserRole } from "@/lib/auth/permissions";

export type ClinicProfile = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
};

type StaffProfile = Omit<ClinicProfile, "organization_id"> & { organization_id: string | null };

// React cache deduplicates work within a server render; it is not a shared tenant cache.
export const getStaffContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/auth/login");

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, organization_id, full_name, email, phone, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !profile.is_active || !Object.hasOwn(roleLabels, profile.role)) {
    redirect("/auth/access");
  }

  return { supabase, user, profile: profile as StaffProfile };
});

export const getClinicContext = cache(async () => {
  const context = await getStaffContext();
  if (!context.profile.organization_id) redirect("/auth/access");
  const { data, error } = await context.supabase.rpc("get_clinic_workspace_status");
  if (error || data !== "active") redirect("/auth/access");
  return { ...context, profile: context.profile as ClinicProfile };
});

export async function requirePermission(permission: Permission) {
  const context = await getClinicContext();
  if (!can(context.profile.role, permission)) throw new Error("Your role cannot perform this action");
  return context;
}

export async function requireClinicPatient(patientId: string, permission: Permission) {
  const context = await requirePermission(permission);
  const { data, error } = await context.supabase.from("patients")
    .select("id").eq("id", patientId).eq("organization_id", context.profile.organization_id).maybeSingle();
  if (error || !data) throw new Error("Patient was not found in your clinic");
  return context;
}
