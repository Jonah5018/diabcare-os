export interface Patient {
  id: string;
  organization_id: string;

  hospital_number: string;

  first_name: string;
  other_names?: string;
  last_name: string;

  gender: "male" | "female";

  date_of_birth: string;

  phone: string;
  address: string;

  next_of_kin_name: string;
  next_of_kin_phone: string;

  migration_source: "new" | "paper" | "import";

  created_at: string;
}