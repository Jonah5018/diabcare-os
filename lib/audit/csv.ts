import type { AuditRow } from "@/types/audit";

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

// Never serialize the raw details object, staff names or clinical content.
export function auditCsv(rows: AuditRow[]) {
  const header = ["event_id", "time_utc", "actor_id", "entity", "record_id", "operation",
    "previous_status", "status", "previous_role", "role", "previous_is_active", "is_active"];
  const values = rows.map(row => [row.id, row.created_at, row.actor_id, row.entity_type,
    row.record_id, row.operation, row.details.previous_status, row.details.status,
    row.details.previous_role, row.details.role, row.details.previous_is_active, row.details.is_active]);
  return [header, ...values].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
