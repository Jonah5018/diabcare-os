"use server";

import { administrationContext, refreshAdministration, runAdministrationCommand } from "@/lib/onboarding/commands";
import { clinicProfileSchema, clinicProvisionSchema, invitationResponseSchema } from "@/lib/validations/onboarding";
import type { AdministrationResult } from "@/types/onboarding";

export async function provisionClinic(form: FormData): Promise<AdministrationResult> {
  const { supabase } = await administrationContext("clinics:create");
  const result = clinicProvisionSchema.safeParse(Object.fromEntries(["name", "slug", "admin_email", "admin_name"].map(key => [key, form.get(key)])));
  if (!result.success) return { error: "Complete the clinic name, valid slug and initial administrator details." };
  const values = result.data;
  const saved = await runAdministrationCommand(supabase, "provision_clinic", {
    p_name: values.name, p_slug: values.slug, p_admin_email: values.admin_email, p_admin_name: values.admin_name,
  });
  const response = invitationResponseSchema.safeParse(saved?.data);
  if (!response.success) return { error: "Clinic could not be provisioned. Check the clinic list before retrying." };
  refreshAdministration();
  return { success: "Clinic created. Share the initial administrator invitation privately.", invitationPath: `/auth/invitation#token=${response.data.token}` };
}

export async function updateClinicProfile(form: FormData): Promise<AdministrationResult> {
  const { supabase, profile } = await administrationContext("clinic:update");
  const result = clinicProfileSchema.safeParse(Object.fromEntries(["name", "email", "phone", "address"].map(key => [key, form.get(key)])));
  if (!result.success) return { error: "Invalid clinic profile details." };
  const values = result.data;
  const saved = await runAdministrationCommand(supabase, "update_clinic_profile", {
    p_clinic: profile.organization_id, p_name: values.name, p_email: values.email, p_phone: values.phone, p_address: values.address,
  });
  if (!saved) return { error: "Clinic profile could not be updated." };
  refreshAdministration();
  return { success: "Clinic profile updated." };
}
