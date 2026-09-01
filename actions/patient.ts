"use server";

import { createClient } from "@/lib/supabase/server";
import { patientSchema } from "@/lib/validations/patient";
import { redirect } from "next/navigation";

export async function createPatient(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");

  const values = patientSchema.parse({
    first_name: formData.get("first_name"),
    other_names: formData.get("other_names") || "",
    last_name: formData.get("last_name"),
    gender: formData.get("gender"),
    date_of_birth: formData.get("date_of_birth"),
    phone: formData.get("phone"),
    address: formData.get("address") || "",
    next_of_kin_name: formData.get("next_of_kin_name") || "",
    next_of_kin_phone: formData.get("next_of_kin_phone") || "",
    migration_source: formData.get("migration_source"),
  });

  const { error } = await supabase.from("patients").insert({
    ...values,
    organization_id: profile.organization_id,
  });

  if (error) throw new Error(error.message);

  redirect("/dashboard/patients");
}