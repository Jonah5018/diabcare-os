import { z } from "zod";
import { getClinicToday } from "@/lib/clinic-date";

export const patientSchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  other_names: z.string().trim().max(500).optional(),
  last_name: z.string().trim().min(2).max(80),

  gender: z.enum(["male", "female"]),

  date_of_birth: z.iso.date("Choose a valid date of birth").refine(value => value <= getClinicToday(), "Date of birth cannot be in the future"),

  phone: z.string().trim().min(10).max(25).regex(/^[+()0-9 -]+$/, "Enter a valid phone number"),

  address: z.string().trim().max(500).optional(),

  next_of_kin_name: z.string().trim().max(500).optional(),

  next_of_kin_phone: z.string().trim().max(500).optional(),

  migration_source: z.enum([
    "new",
    "paper",
    "import",
  ]),
});

export type PatientFormData = z.infer<
  typeof patientSchema
>;
