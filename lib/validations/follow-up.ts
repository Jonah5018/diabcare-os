import { z } from "zod";
import { getClinicToday } from "@/lib/clinic-date";

export const followUpSchema = z.object({
  patient_id: z.uuid(),
  consultation_id: z.preprocess(value => value === "" ? null : value, z.uuid().nullable()),
  request_id: z.uuid(),
  due_date: z.iso.date().refine(
    date => date >= getClinicToday() && date <= "2100-12-31",
    "Choose today or a future follow-up date up to 2100"
  ),
  reason: z.string().trim().min(1, "Enter the follow-up reason").max(2000, "Reason is too long"),
});

export const followUpTransitionSchema = z.object({
  follow_up_id: z.uuid(),
  status: z.enum(["completed", "cancelled"]),
});
