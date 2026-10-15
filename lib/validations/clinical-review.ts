import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true }).nullable();
const measurement = z.number().finite().nullable();
const previewText = z.string().nullable().transform(value => value?.trim().slice(0, 200) || null);

export const reviewPatientSchema = z.object({
  id: z.uuid(),
  first_name: z.string(),
  last_name: z.string(),
  hospital_number: z.string(),
});

export const reviewVitalSchema = z.object({
  id: z.uuid(),
  created_at: timestamp,
  weight: measurement,
  systolic_bp: measurement,
  diastolic_bp: measurement,
  fasting_blood_sugar: measurement,
  random_blood_sugar: measurement,
});

export const reviewLabSchema = z.object({
  id: z.uuid(),
  created_at: timestamp,
  hba1c: measurement,
  creatinine: measurement,
});

export const reviewConsultationSchema = z.object({
  id: z.uuid(),
  created_at: timestamp,
  visit_date: timestamp,
  chief_complaint: previewText,
  diagnosis: previewText,
});

export const reviewAppointmentSchema = z.object({
  id: z.uuid(),
  appointment_date: z.iso.date(),
  status: z.enum(["scheduled", "waiting", "in_consultation", "completed", "cancelled"]),
});

export const reviewPrescriptionSchema = z.object({
  id: z.uuid(),
  prescribed_date: z.iso.date(),
  status: z.literal("active"),
  items: z.array(z.object({
    id: z.uuid(),
    position: z.number().int().min(1).max(20),
    medication_name: z.string(),
    strength: z.string(),
    dose: z.string(),
    frequency: z.string(),
  })).max(20),
});

export const reviewFollowUpSchema = z.object({
  id: z.uuid(),
  due_date: z.iso.date(),
  status: z.literal("planned"),
  reason: previewText,
});
