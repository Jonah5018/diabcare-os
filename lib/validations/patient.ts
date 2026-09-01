import { z } from "zod";

export const patientSchema = z.object({
  first_name: z.string().min(2),
  other_names: z.string().optional(),
  last_name: z.string().min(2),

  gender: z.enum(["male", "female"]),

  date_of_birth: z.string(),

  phone: z.string().min(11),

  address: z.string().optional(),

  next_of_kin_name: z.string().optional(),

  next_of_kin_phone: z.string().optional(),

  migration_source: z.enum([
    "new",
    "paper",
    "import",
  ]),
});

export type PatientFormData = z.infer<
  typeof patientSchema
>;