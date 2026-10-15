import "server-only";

import { z } from "zod";
import { getClinicContext } from "@/lib/auth/context";
import { getClinicToday } from "@/lib/clinic-date";
import { cursorFilter, PAGE_SIZE } from "@/lib/pagination";
import { dueCursorFilter } from "@/lib/follow-ups/pagination";
import type { FollowUpRow } from "@/types/follow-up";

const selection = `id, patient_id, consultation_id, created_by, due_date, reason, status, created_at, resolved_at,
  patient:patients!follow_ups_patient_clinic_fkey(first_name, last_name, hospital_number)`;

export async function getFollowUpHistory(patientId: string, cursor: string) {
  z.uuid().parse(patientId);
  const { supabase, profile } = await getClinicContext();
  let query = supabase.from("follow_ups").select(selection)
    .eq("organization_id", profile.organization_id).eq("patient_id", patientId)
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  const filter = cursorFilter(cursor);
  if (cursor && !filter) throw new Error("Invalid follow-up history cursor");
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load follow-up history");
  return { rows: ((data ?? []) as unknown as FollowUpRow[]).slice(0, PAGE_SIZE), hasMore: (data?.length ?? 0) > PAGE_SIZE };
}

export type FollowUpWindow = "upcoming" | "overdue";

export async function getClinicFollowUps(window: FollowUpWindow, cursor = "", limit = PAGE_SIZE) {
  const { supabase, profile } = await getClinicContext();
  let query = supabase.from("follow_ups").select(selection)
    .eq("organization_id", profile.organization_id).eq("status", "planned")
    .order("due_date", { ascending: true }).order("id", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), PAGE_SIZE) + 1);
  query = window === "overdue" ? query.lt("due_date", getClinicToday()) : query.gte("due_date", getClinicToday());
  const filter = dueCursorFilter(cursor);
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load clinic follow-up plans");
  const pageSize = Math.min(Math.max(limit, 1), PAGE_SIZE);
  return { rows: ((data ?? []) as unknown as FollowUpRow[]).slice(0, pageSize), hasMore: (data?.length ?? 0) > pageSize };
}
