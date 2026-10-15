import "server-only";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/context";
import { getClinicToday } from "@/lib/clinic-date";
import {
  reviewAppointmentSchema,
  reviewConsultationSchema,
  reviewFollowUpSchema,
  reviewLabSchema,
  reviewPatientSchema,
  reviewPrescriptionSchema,
  reviewVitalSchema,
} from "@/lib/validations/clinical-review";
import type { ClinicalReviewData } from "@/types/clinical-review";

export const REVIEW_MEASUREMENT_LIMIT = 12;

function slice<T>(schema: z.ZodType<T>, rows: unknown, limit: number) {
  const parsed = z.array(schema).max(limit + 1).safeParse(rows);
  if (!parsed.success) throw new Error("Unable to load the clinical review");

  return { rows: parsed.data.slice(0, limit), hasMore: parsed.data.length > limit };
}

export async function getClinicalReview(patientId: string): Promise<ClinicalReviewData | null> {
  const patient = z.uuid().parse(patientId);
  const { supabase, profile } = await requirePermission("clinical-review:view");
  const clinic = profile.organization_id;
  const today = getClinicToday();

  const patientResult = await Promise.resolve(supabase.from("patients")
    .select("id,first_name,last_name,hospital_number")
    .eq("id", patient).eq("organization_id", clinic).maybeSingle())
    .catch(() => null);
  if (!patientResult || patientResult.error) throw new Error("Unable to load the clinical review");
  if (!patientResult.data) return null;
  const identity = reviewPatientSchema.safeParse(patientResult.data);
  if (!identity.success) throw new Error("Unable to load the clinical review");

  type Table = "vitals" | "laboratory_results" | "consultations" | "appointments" | "prescriptions" | "follow_ups";
  const history = (table: Table, selection: string, limit: number, order = "created_at", ascending = false) => supabase.from(table)
    .select(selection)
    .eq("organization_id", clinic)
    .eq("patient_id", patient)
    .order(order, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .limit(limit + 1);

  const results = await Promise.all([
    history("vitals", "id,created_at,weight,systolic_bp,diastolic_bp,fasting_blood_sugar,random_blood_sugar", REVIEW_MEASUREMENT_LIMIT),
    history("laboratory_results", "id,created_at,hba1c,creatinine", REVIEW_MEASUREMENT_LIMIT),
    history("consultations", "id,created_at,visit_date,chief_complaint,diagnosis", 3),
    history("appointments", "id,appointment_date,status", 5, "appointment_date").lte("appointment_date", today),
    history("prescriptions", `id,prescribed_date,status,
      items:prescription_items!prescription_items_prescription_clinic_fkey(id,position,medication_name,strength,dose,frequency)`, 5).eq("status", "active"),
    history("follow_ups", "id,due_date,status,reason", 5, "due_date", true).eq("status", "planned"),
  ]).catch(() => null);

  if (!results || results.some(result => result.error)) throw new Error("Unable to load the clinical review");

  return {
    patient: identity.data,
    today,
    vitals: slice(reviewVitalSchema, results[0].data, REVIEW_MEASUREMENT_LIMIT),
    laboratories: slice(reviewLabSchema, results[1].data, REVIEW_MEASUREMENT_LIMIT),
    consultations: slice(reviewConsultationSchema, results[2].data, 3),
    appointments: slice(reviewAppointmentSchema, results[3].data, 5),
    prescriptions: slice(reviewPrescriptionSchema, results[4].data, 5),
    followUps: slice(reviewFollowUpSchema, results[5].data, 5),
  };
}
