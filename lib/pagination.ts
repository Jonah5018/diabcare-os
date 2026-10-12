import { z } from "zod";

export const PAGE_SIZE = 25;
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const cursorSchema = z.object({
  id: z.uuid(),
  created_at: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).nullable(),
});

export function scalar(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export function encodeCursor(row: { id: string; created_at: string | null }) {
  return Buffer.from(JSON.stringify({ id: row.id, created_at: row.created_at })).toString("base64url");
}

export function cursorFilter(raw: string, column: "created_at" | "visit_date" | "appointment_date" = "created_at") {
  if (!raw || raw.length > 400) return null;
  try {
    const result = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    if (!result.success) return null;
    const { id, created_at: time } = result.data;
    return time
      ? `${column}.lt.${time},and(${column}.eq.${time},id.lt.${id}),${column}.is.null`
      : `and(${column}.is.null,id.lt.${id})`;
  } catch {
    return null;
  }
}

// Only literal search characters enter PostgREST filter expressions.
export function searchTerms(value: string) {
  return value.slice(0, 80).replace(/[^\p{L}\p{N} +\-']/gu, " ").trim().split(/\s+/).filter(Boolean).slice(0, 4);
}
