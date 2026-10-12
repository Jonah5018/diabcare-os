"use server";

import { saveClinicalRecord } from "@/lib/clinical-actions";
import { consultationSchema } from "@/lib/validations/clinical";

export async function createConsultation(formData: FormData) {
  return saveClinicalRecord(formData, consultationSchema, "consultations:create", "consultations",
    (values, userId) => ({ ...values, doctor_id: userId }));
}
