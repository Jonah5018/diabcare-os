"use server";

import { saveClinicalRecord } from "@/lib/clinical-actions";
import { labSchema } from "@/lib/validations/clinical";

export async function createLabResult(formData: FormData) {
  return saveClinicalRecord(formData, labSchema, "laboratory:create", "laboratory_results",
    (values, userId) => ({ ...values, recorded_by: userId }));
}
