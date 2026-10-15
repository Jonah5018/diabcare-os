"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { searchTerms } from "@/lib/pagination";
import { appointmentSchema } from "@/lib/validations/appointment";
import type {
  AppointmentFormState,
  AppointmentStatus,
} from "@/types/appointment";

const getCurrentUserContext = getClinicContext;

function revalidateAppointments() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/patients/[id]", "page");
}

export async function createAppointment(
  _previousState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!can(profile.role, "appointments:create")) return { error: "Your role cannot book appointments" };

  const result = appointmentSchema.safeParse({
    patient_id: String(formData.get("patient_id") ?? ""),
    doctor_id: String(formData.get("doctor_id") ?? "").trim() || null,
    appointment_date: String(formData.get("appointment_date") ?? ""),
    appointment_time: String(formData.get("appointment_time") ?? "").trim() || null,
    reason: String(formData.get("reason") ?? "").trim() || null,
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const values = result.data;

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", values.patient_id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (patientError || !patient) {
    return { error: "Patient was not found in your clinic" };
  }

  if (values.doctor_id) {
    const { data: doctor, error: doctorError } = await supabase
      .from("users")
      .select("id, role, is_active")
      .eq("id", values.doctor_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (doctorError || !doctor || doctor.role !== "doctor" || !doctor.is_active) {
      return { error: "Selected doctor is not available in your clinic" };
    }
  }

  const { error } = await supabase.from("appointments").insert({
    patient_id: values.patient_id,
    organization_id: profile.organization_id,
    doctor_id: values.doctor_id,
    appointment_date: values.appointment_date,
    appointment_time: values.appointment_time,
    reason: values.reason,
    status: "scheduled",
    created_by: user.id,
  });

  if (error) {
    return { error: "Unable to book the appointment. Please try again." };
  }

  revalidateAppointments();

  return { success: "Appointment booked. Check the patient in when they arrive." };
}

export async function checkInAppointment(appointmentId: string) {
  const { supabase, profile } = await getCurrentUserContext();
  if (!can(profile.role, "appointments:update")) throw new Error("Your role cannot update appointments");
  if (!z.uuid().safeParse(appointmentId).success) throw new Error("Invalid appointment identifier");

  // The database validates the clinic date and assigns the queue number atomically.
  try {
    const { error } = await supabase.rpc("check_in_appointment", {
      p_appointment_id: appointmentId,
    });
    if (error) throw error;
  } catch {
    throw new Error("Check-in could not be confirmed. Refresh the clinic queue before retrying.");
  }

  revalidateAppointments();
}

async function transitionAppointment(
  appointmentId: string,
  fromStatus: AppointmentStatus | AppointmentStatus[],
  toStatus: AppointmentStatus
) {
  const { supabase, profile } = await getCurrentUserContext();

  if (!can(profile.role, "appointments:update")) throw new Error("Your role cannot update appointments");
  if (!z.uuid().safeParse(appointmentId).success) throw new Error("Invalid appointment identifier");

  const baseQuery = supabase
    .from("appointments")
    .update({ status: toStatus })
    .eq("id", appointmentId)
    .eq("organization_id", profile.organization_id);

  let updated = false;
  try {
    const result = Array.isArray(fromStatus)
      ? await baseQuery.in("status", fromStatus).select("id").maybeSingle()
      : await baseQuery.eq("status", fromStatus).select("id").maybeSingle();
    if (result.error) throw result.error;
    updated = Boolean(result.data);
  } catch {
    throw new Error("Appointment update could not be confirmed. Refresh its history before retrying.");
  }

  if (!updated) {
    throw new Error(
      "Appointment could not be updated. It may already have changed status."
    );
  }

  revalidateAppointments();
}

export async function startConsultation(appointmentId: string) {
  await transitionAppointment(appointmentId, "waiting", "in_consultation");
}

export async function completeAppointment(appointmentId: string) {
  await transitionAppointment(appointmentId, "in_consultation", "completed");
}

export async function cancelAppointment(appointmentId: string) {
  await transitionAppointment(
    appointmentId,
    ["scheduled", "waiting", "in_consultation"],
    "cancelled"
  );
}

export async function searchAppointmentPatients(text: string) {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "appointments:create")) return { error: "Your role cannot book appointments", patients: [] };
  let query = supabase.from("patients").select("id, hospital_number, first_name, other_names, last_name")
    .eq("organization_id", profile.organization_id).order("last_name").order("id").limit(20);
  for (const term of searchTerms(text)) query = query.ilike("search_text", "%" + term + "%");
  const { data, error } = await query;
  return error ? { error: "Unable to search clinic patients", patients: [] } : { patients: data ?? [] };
}

export async function searchAppointmentDoctors(text: string) {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "appointments:create")) return { error: "Your role cannot book appointments", doctors: [] };
  let query = supabase.from("users").select("id, full_name")
    .eq("organization_id", profile.organization_id).eq("role", "doctor").eq("is_active", true)
    .order("full_name").order("id").limit(20);
  for (const term of searchTerms(text)) query = query.ilike("full_name", `%${term}%`);
  const { data, error } = await query;
  return error ? { error: "Unable to search clinic doctors", doctors: [] } : { doctors: data ?? [] };
}
