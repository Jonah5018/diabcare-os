"use server";

import { saveClinicalRecord } from "@/lib/clinical-actions";
import { vitalsSchema } from "@/lib/validations/clinical";

export async function createVitals(formData: FormData) {
  return saveClinicalRecord(formData, vitalsSchema, "vitals:create", "vitals", (values, userId) => ({
    ...values,
    recorded_by: userId,
    bmi: Number((values.weight / ((values.height / 100) ** 2)).toFixed(1)),
  }));
}
