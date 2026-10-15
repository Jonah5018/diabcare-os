import { z } from "zod";

const dueCursorSchema = z.object({ date: z.iso.date(), id: z.uuid() }).strict();

export function encodeDueCursor(row: { due_date: string; id: string }) {
  return Buffer.from(JSON.stringify({ date: row.due_date, id: row.id })).toString("base64url");
}

export function dueCursorFilter(value: string) {
  if (!value) return null;
  if (value.length > 400 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid follow-up cursor");
  try {
    const { date, id } = dueCursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return `due_date.gt.${date},and(due_date.eq.${date},id.gt.${id})`;
  } catch {
    throw new Error("Invalid follow-up cursor");
  }
}
