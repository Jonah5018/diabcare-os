import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";
import { getClinicContext } from "@/lib/auth/context";
import type { AppointmentStatus } from "@/types/appointment";

export interface PatientVisit {
  id: string;
  status: AppointmentStatus;
  appointment_date: string;
  queue_number: number | null;
}

export async function getPatientVisit(patientId: string, appointmentId: string): Promise<PatientVisit | null> {
  if (!appointmentId) return null;
  if (!z.uuid().safeParse(appointmentId).success) notFound();

  const { supabase, profile } = await getClinicContext();
  const { data, error } = await supabase.from("appointments")
    .select("id, status, appointment_date, queue_number")
    .eq("id", appointmentId)
    .eq("patient_id", patientId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (error) throw new Error("Unable to load visit context");
  if (!data) notFound();
  return data as PatientVisit;
}

export async function getVisitRecordCounts(patientId: string, appointmentId: string) {
  const { supabase, profile } = await getClinicContext();
  const count = (table: string) => supabase.from(table)
    .select("id", { head: true, count: "exact" })
    .eq("appointment_id", appointmentId)
    .eq("patient_id", patientId)
    .eq("organization_id", profile.organization_id);

  const results = await Promise.all([
    count("vitals"), count("consultations"), count("laboratory_results"),
    supabase.from("prescriptions")
      .select("id, consultation:consultations!prescriptions_consultation_patient_clinic_fkey!inner(appointment_id)", {
        head: true, count: "exact",
      })
      .eq("organization_id", profile.organization_id)
      .eq("patient_id", patientId)
      .eq("consultation.appointment_id", appointmentId),
  ]);

  if (results.some(result => result.error)) return null;
  return results.map(result => result.count ?? 0);
}
