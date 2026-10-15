export interface AuditDetails {
  status?: string;
  previous_status?: string;
  role?: string;
  previous_role?: string;
  is_active?: boolean | null;
  previous_is_active?: boolean | null;
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  record_id: string;
  created_at: string;
  entity_type: string;
  operation: string;
  details: AuditDetails;
  actor: { full_name: string } | null;
}

export interface RetentionDraft {
  retention_days: number | null;
  legal_hold: boolean;
  deletion_enabled: false;
  archive_required: true;
  updated_at?: string;
}
