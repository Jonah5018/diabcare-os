import "server-only";

import { requirePermission } from "@/lib/auth/context";
import { PAGE_SIZE } from "@/lib/pagination";
import type { AuditFilters } from "@/lib/audit/filters";
import type { AuditRow, RetentionDraft } from "@/types/audit";

export const EXPORT_PAGE_SIZE = 200;

export async function getAuditPage(filters: AuditFilters, exporting = false) {
  const { supabase, profile } = await requirePermission(exporting ? "audit:export" : "team:view");
  const limit = exporting ? EXPORT_PAGE_SIZE : PAGE_SIZE;
  let query = supabase.from("audit_events")
    .select("id, actor_id, record_id, created_at, entity_type, operation, details, actor:users!audit_events_actor_id_fkey(full_name)")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", filters.startTime).lt("created_at", filters.endTime)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (filters.actor) query = query.eq("actor_id", filters.actor);
  if (filters.record) query = query.eq("record_id", filters.record);
  if (filters.entity) query = query.eq("entity_type", filters.entity);
  if (filters.operation) query = query.eq("operation", filters.operation);
  if (filters.filter) query = query.or(filters.filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load filtered audit history");
  return { rows: ((data ?? []) as unknown as AuditRow[]).slice(0, limit), hasMore: (data?.length ?? 0) > limit };
}

export async function getRetentionDraft(): Promise<RetentionDraft> {
  const { supabase, profile } = await requirePermission("team:view");
  const { data, error } = await supabase.from("audit_retention_settings")
    .select("retention_days, legal_hold, archive_required, deletion_enabled, updated_at")
    .eq("organization_id", profile.organization_id).maybeSingle();
  if (error) throw new Error("Unable to load retention draft");
  return data ?? { retention_days: null, legal_hold: true, archive_required: true, deletion_enabled: false };
}
