import { z } from "zod";
import { TIMELINE_KINDS, type TimelineCursor } from "@/types/timeline";

const cursorSchema = z.object({
  time: z.iso.datetime({ offset: true }).nullable(),
  kind: z.enum(TIMELINE_KINDS),
  id: z.uuid(),
}).strict();

export function encodeTimelineCursor(cursor: TimelineCursor): string {
  // Preserve PostgreSQL microseconds rather than rounding through JavaScript Date.
  return Buffer.from(JSON.stringify(cursorSchema.parse(cursor))).toString("base64url");
}

export function decodeTimelineCursor(value: string): TimelineCursor | null {
  if (!value || value.length > 600 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
