// Keep appointment booking, dashboard counts, and the database check-in RPC
// aligned with the clinic's current timezone.
export function getClinicToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine clinic date");
  }

  return `${year}-${month}-${day}`;
}

export function formatAppointmentDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function formatAppointmentTime(value: string | null) {
  if (!value) {
    return "No fixed time";
  }

  const [hour, minute] = value.slice(0, 5).split(":").map(Number);

  // A stored appointment time is a wall-clock time, not a timestamp.
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}
