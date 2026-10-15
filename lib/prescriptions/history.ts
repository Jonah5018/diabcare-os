import "server-only";

import { getClinicContext } from "@/lib/auth/context";
import { cursorFilter, PAGE_SIZE } from "@/lib/pagination";
import type { PrescriptionHistoryRow } from "@/types/prescription";

export async function getPrescriptionHistory(patientId: string, cursor: string) {
  const { supabase, profile } = await getClinicContext();

  let query = supabase.from("prescriptions")
    .select(`
      id, prescriber_id, consultation_id, status, prescribed_date, created_at, updated_at,
      prescriber:users!prescriptions_prescriber_clinic_fkey(full_name),
      items:prescription_items!prescription_items_prescription_clinic_fkey(
        id, position, medication_name, strength, dose, frequency, route, duration, instructions
      )
    `)
    .eq("organization_id", profile.organization_id)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const filter = cursorFilter(cursor);
  if (filter) query = query.or(filter);

  const { data, error } = await query;
  if (error) throw new Error("Unable to load prescription history");

  return {
    rows: ((data ?? []) as unknown as PrescriptionHistoryRow[]).slice(0, PAGE_SIZE),
    hasMore: (data?.length ?? 0) > PAGE_SIZE,
  };
}
