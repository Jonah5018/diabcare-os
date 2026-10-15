import "server-only";

import { z } from "zod";
import { getClinicContext } from "@/lib/auth/context";
import { PAGE_SIZE } from "@/lib/pagination";
import { decodeTimelineCursor } from "@/lib/timeline/cursor";
import { TIMELINE_KINDS } from "@/types/timeline";

const eventSchema = z.object({
  event_kind: z.enum(TIMELINE_KINDS),
  source_id: z.uuid(),
  occurred_at: z.iso.datetime({ offset: true }).nullable(),
  appointment_id: z.uuid().nullable(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

export async function getPatientTimeline(patientId: string, encodedCursor: string) {
  const patient = z.uuid().parse(patientId);
  const { supabase } = await getClinicContext();
  const cursor = decodeTimelineCursor(encodedCursor);
  if (encodedCursor && !cursor) throw new Error("Invalid timeline cursor");

  const { data, error } = await supabase.rpc("get_patient_timeline", {
    p_patient_id: patient,
    p_cursor_time: cursor?.time ?? null,
    p_cursor_kind: cursor?.kind ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: PAGE_SIZE + 1,
  });

  if (error) throw new Error("Unable to load patient timeline");

  const rows = z.array(eventSchema).max(PAGE_SIZE + 1).parse(data ?? []);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
