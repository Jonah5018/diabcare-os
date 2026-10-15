import { z } from "zod";
import { getClinicToday } from "@/lib/clinic-date";

const requiredText = (maximum: number) => z.string().trim()
  .min(1, "Complete every required medication field")
  .max(maximum, "Medication text is too long");

export const medicationItemSchema = z.object({
  medication_name: requiredText(200),
  strength: requiredText(100),
  dose: requiredText(100),
  frequency: requiredText(100),
  route: z.string().trim().max(80).default(""),
  duration: requiredText(100),
  instructions: z.string().trim().max(2000).default(""),
});

export const prescriptionSchema = z.object({
  patient_id: z.uuid(),
  consultation_id: z.uuid(),
  request_id: z.uuid(),
  prescribed_date: z.iso.date().refine(
    date => date >= "1900-01-01" && date <= getClinicToday(),
    "Use a valid prescribed date up to today's clinic date"
  ),
  items: z.array(medicationItemSchema).min(1).max(20),
});

export const prescriptionTransitionSchema = z.object({
  prescription_id: z.uuid(),
  status: z.enum(["completed", "cancelled"]),
});
