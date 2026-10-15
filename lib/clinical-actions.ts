import "server-only";
import { emitOperationalEvent, newRequestId } from "@/lib/observability/events";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getClinicContext } from "@/lib/auth/context";
import { can, type Permission } from "@/lib/auth/permissions";
import type { FormResult } from "@/types/forms";

export async function saveClinicalRecord<T extends { patient_id: string; appointment_id?: string | null }>(
  formData: FormData,
  schema: z.ZodType<T>,
  permission: Permission,
  table: "vitals" | "consultations" | "laboratory_results",
  record: (values: T, userId: string) => Record<string, unknown>
): Promise<FormResult> {
  const { supabase, user, profile } = await getClinicContext();
  if (!can(profile.role, permission)) return { error: "Your role cannot record this clinical information" };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: patient, error: patientError } = await supabase.from("patients")
    .select("id").eq("id", parsed.data.patient_id).eq("organization_id", profile.organization_id).maybeSingle();
  if (patientError || !patient) return { error: "Patient was not found in your clinic" };

  if (parsed.data.appointment_id) {
    const { data: visit, error: visitError } = await supabase.from("appointments")
      .select("status")
      .eq("id", parsed.data.appointment_id)
      .eq("patient_id", parsed.data.patient_id)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (visitError || !visit || !["waiting", "in_consultation", "completed"].includes(visit.status)) {
      return { error: "This visit is not available for clinical recording. Refresh the patient folder." };
    }
  }

  const { error } = await supabase.from(table).insert({ ...record(parsed.data, user.id), organization_id: profile.organization_id });
  if (error) {
    emitOperationalEvent({ event: "clinical_write", request_id: newRequestId(), outcome: "failed" });
    return { error: "Unable to save this record. Please try again." };
  }
  revalidatePath(`/dashboard/patients/${parsed.data.patient_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/consultations");
  revalidatePath("/dashboard/laboratory");
  revalidatePath("/dashboard/reports");
  return { success: "Clinical record saved." };
}
