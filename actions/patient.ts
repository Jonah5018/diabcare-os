"use server";

import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { patientSchema } from "@/lib/validations/patient";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FormResult } from "@/types/forms";

export async function createPatient(formData: FormData): Promise<FormResult> {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "patients:create")) return { error: "Your role cannot register patients" };
  const result = patientSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0].message };
  const { error } = await supabase.from("patients").insert({ ...result.data, organization_id: profile.organization_id });
  if (error) return { error: "Unable to register this patient. Please try again." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/patients");
  redirect("/dashboard/patients");
}
