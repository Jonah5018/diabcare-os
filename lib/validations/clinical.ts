import { z } from "zod";

const patient_id = z.uuid("Select a valid patient");
const appointment_id = z.preprocess(
  value => value === "" ? null : value,
  z.uuid("Select a valid visit").nullish()
);
const requiredText = z.string().trim().min(1, "Complete all required clinical fields").max(5000, "Clinical text is too long");
const optionalText = z.string().trim().max(5000, "Clinical text is too long").default("");
const measurement = (integer = false) => z.preprocess(
  value => typeof value === "string" && value.trim() !== "" ? Number(value) : value,
  integer ? z.number().int("Use a whole number").nonnegative("Measurements cannot be negative") : z.number().nonnegative("Measurements cannot be negative")
);

export const consultationSchema = z.object({
  patient_id,
  appointment_id,
  chief_complaint: requiredText,
  diagnosis: requiredText,
  treatment_plan: optionalText,
  notes: optionalText,
});
export const vitalsSchema = z.object({
  patient_id,
  appointment_id,
  systolic_bp: measurement(true).refine(value => value > 0, "Enter systolic blood pressure"),
  diastolic_bp: measurement(true).refine(value => value > 0, "Enter diastolic blood pressure"),
  pulse: measurement(true),
  spo2: measurement(true).refine(value => value <= 100, "SpO₂ cannot exceed 100%"),
  temperature: measurement(),
  weight: measurement().refine(value => value > 0, "Weight must be greater than zero"),
  height: measurement().refine(value => value > 0, "Height must be greater than zero"),
  fasting_blood_sugar: measurement(),
  random_blood_sugar: measurement(),
});
export const labSchema = z.object({
  patient_id,
  appointment_id,
  hba1c: measurement().refine(value => value <= 100, "HbA1c cannot exceed 100%"),
  creatinine: measurement(), total_cholesterol: measurement(), hdl: measurement(), ldl: measurement(), triglycerides: measurement(),
  urine_protein: z.enum(["Negative", "Trace", "1+", "2+", "3+"]),
  urine_glucose: z.enum(["Negative", "Trace", "1+", "2+", "3+"]),
  notes: optionalText,
});
