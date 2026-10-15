import { z } from "zod";
import { cursorFilter, scalar } from "@/lib/pagination";
import { reportWindow } from "@/lib/reporting";

export const auditEntities = [
  "patients", "appointments", "consultations", "vitals", "laboratory_results",
  "prescriptions", "prescription_items", "follow_ups", "staff_invitations",
  "organizations", "users", "audit_events", "audit_retention_settings", "clinical_documents", "notification_events",
] as const;
export const auditOperations = ["INSERT", "UPDATE", "DELETE", "EXPORT", "ACCESS"] as const;

const optionalUuid = z.union([z.literal(""), z.uuid()]);
const optionalEntity = z.union([z.literal(""), z.enum(auditEntities)]);
const optionalOperation = z.union([z.literal(""), z.enum(auditOperations)]);

export function auditFilters(params: Record<string, string | string[] | undefined>) {
  const window = reportWindow(scalar(params.from), scalar(params.to));
  if ("error" in window) throw new Error(window.error);
  const fields = z.object({
    actor: optionalUuid,
    record: optionalUuid,
    entity: optionalEntity,
    operation: optionalOperation,
  }).safeParse({
    actor: scalar(params.actor),
    record: scalar(params.record),
    entity: scalar(params.entity),
    operation: scalar(params.operation),
  });
  if (!fields.success) throw new Error("Choose a valid actor, record, entity and operation");
  const cursor = scalar(params.cursor);
  const filter = cursorFilter(cursor);
  if (cursor && !filter) throw new Error("Invalid audit page cursor");
  return { ...window, ...fields.data, cursor, filter };
}

export type AuditFilters = ReturnType<typeof auditFilters>;

export function auditQuery(filters: AuditFilters) {
  return { from: filters.from, to: filters.to, actor: filters.actor,
    record: filters.record, entity: filters.entity, operation: filters.operation };
}
