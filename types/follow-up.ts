export interface FollowUpResult {
  success?: string;
  error?: string;
}

export interface FollowUpRow {
  id: string;
  patient_id: string;
  consultation_id: string | null;
  created_by: string;
  due_date: string;
  reason: string;
  status: "planned" | "completed" | "cancelled";
  created_at: string;
  resolved_at: string | null;
  patient: { first_name: string; last_name: string; hospital_number: string } | null;
}
