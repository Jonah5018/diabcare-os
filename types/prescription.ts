export type PrescriptionStatus = "active" | "completed" | "cancelled";

export interface MedicationItem {
  medication_name: string;
  strength: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionHistoryRow {
  id: string;
  prescriber_id: string;
  consultation_id: string;
  status: PrescriptionStatus;
  prescribed_date: string;
  created_at: string;
  updated_at: string;
  prescriber: { full_name: string } | null;
  items: (MedicationItem & { id: string; position: number })[];
}

export interface PrescriptionFormResult {
  error?: string;
  success?: string;
}
