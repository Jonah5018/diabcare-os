import { z } from "zod";
import { getClinicToday } from "@/lib/clinic-date";

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function reportWindow(from: string, to: string) {
  const today = getClinicToday();
  const start = from || shiftDate(today, -29), end = to || today;
  if (!z.iso.date().safeParse(start).success || !z.iso.date().safeParse(end).success) return { error: "Choose valid report dates" } as const;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (days < 0 || days > 30) return { error: "Choose a date range of up to 31 days" } as const;
  return {
    from: start, to: end,
    startTime: new Date(`${start}T00:00:00+01:00`).toISOString(),
    endTime: new Date(`${shiftDate(end, 1)}T00:00:00+01:00`).toISOString(),
  };
}
