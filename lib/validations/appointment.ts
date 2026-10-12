import { z } from "zod";

import { getClinicToday } from "@/lib/clinic-date";

export const appointmentSchema = z.object({
  patient_id: z.string().uuid("Select a valid patient"),
  doctor_id: z.string().uuid("Select a valid doctor").nullable(),
  appointment_date: z.iso
    .date("Select a valid appointment date")
    .refine((date) => date >= getClinicToday(), {
      message: "Appointments cannot be booked in the past",
    }),
  appointment_time: z.iso
    .time({ precision: -1, error: "Select a valid appointment time" })
    .nullable(),
  reason: z.string().trim().max(500, "Reason is too long").nullable(),
});
