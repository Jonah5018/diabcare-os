"use server";

import { revalidatePath } from "next/cache";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import {
  prescriptionSchema,
  prescriptionTransitionSchema,
} from "@/lib/validations/prescription";
import type { PrescriptionFormResult } from "@/types/prescription";

type ClinicClient = Awaited<ReturnType<typeof getClinicContext>>["supabase"];

async function executePrescriptionCommand(
  supabase: ClinicClient,
  name: "create_prescription" | "transition_prescription",
  parameters: Record<string, unknown>
) {
  try {
    const { error } = await supabase.rpc(name, parameters);
    return !error;
  } catch {
    // Transport failures need the same safe feedback as returned RPC errors.
    return false;
  }
}

function refreshPrescriptionPages(patientId?: string) {
  if (patientId) revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/patients/[id]", "page");
  revalidatePath("/dashboard/consultations");
  revalidatePath("/dashboard/audit");
}

export async function createPrescription(
  _previous: PrescriptionFormResult,
  formData: FormData
): Promise<PrescriptionFormResult> {
  const { supabase, profile } = await getClinicContext();

  if (!can(profile.role, "prescriptions:create")) {
    return { error: "Your role cannot create prescriptions" };
  }

  const rawItems = formData.get("items");
  let items: unknown;

  if (typeof rawItems !== "string" || rawItems.length > 60000) {
    return { error: "Invalid medication items" };
  }

  try {
    items = JSON.parse(rawItems);
  } catch {
    return { error: "Invalid medication items" };
  }

  const result = prescriptionSchema.safeParse({
    patient_id: formData.get("patient_id"),
    consultation_id: formData.get("consultation_id"),
    request_id: formData.get("request_id"),
    prescribed_date: formData.get("prescribed_date"),
    items,
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const values = result.data;
  const saved = await executePrescriptionCommand(supabase, "create_prescription", {
    p_patient_id: values.patient_id,
    p_consultation_id: values.consultation_id,
    p_prescribed_date: values.prescribed_date,
    p_items: values.items,
    p_request_id: values.request_id,
  });

  if (!saved) {
    // Database errors may include medication values; return no raw error detail.
    return { error: "Prescription could not be saved. Check the patient history before retrying." };
  }

  refreshPrescriptionPages(values.patient_id);
  return { success: "Prescription saved. Open the patient folder to view it." };
}

export async function transitionPrescription(formData: FormData): Promise<PrescriptionFormResult> {
  const { supabase, profile } = await getClinicContext();

  if (!can(profile.role, "prescriptions:update")) {
    return { error: "Your role cannot update prescriptions" };
  }

  const result = prescriptionTransitionSchema.safeParse({
    prescription_id: formData.get("prescription_id"),
    status: formData.get("status"),
  });

  if (!result.success) return { error: "Invalid prescription action" };

  const updated = await executePrescriptionCommand(supabase, "transition_prescription", {
    p_prescription_id: result.data.prescription_id,
    p_status: result.data.status,
  });

  if (!updated) {
    return { error: "Prescription could not be updated. Refresh its history and try again." };
  }

  refreshPrescriptionPages();
  return { success: "Prescription status updated." };
}
