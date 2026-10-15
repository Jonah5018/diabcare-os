import "server-only";

import { requirePermission } from "@/lib/auth/context";
import { cursorFilter, PAGE_SIZE } from "@/lib/pagination";
import type { NotificationEvent } from "@/types/notification";

export async function getNotifications(cursor: string, management = false) {
  const { supabase, profile } = await requirePermission("notifications:view");
  let query = supabase.from("notification_events")
    .select("id, organization_id, patient_id, kind, provider, status, available_at, attempt_count, created_at, delivered_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  if (!management) query = query.eq("status", "delivered");
  const filter = cursorFilter(cursor);
  if (cursor && !filter) throw new Error("Invalid notification cursor");
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load notifications");
  return { rows: ((data ?? []) as NotificationEvent[]).slice(0, PAGE_SIZE), hasMore: (data?.length ?? 0) > PAGE_SIZE };
}
