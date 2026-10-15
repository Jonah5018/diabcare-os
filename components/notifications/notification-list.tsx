import Link from "next/link";
import { notificationTitles, type NotificationEvent } from "@/types/notification";

export default function NotificationList({ rows }: { rows: NotificationEvent[] }) {
  if (!rows.length) return <p className="rounded-xl border bg-white p-5 text-slate-500">No notifications in this view yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map(event => (
        <article key={event.id} className="space-y-2 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="font-medium">{notificationTitles[event.kind]}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{event.status}</span>
          </div>
          <p className="text-sm text-slate-500">Provider: {event.provider === "in_app" ? "clinic inbox" : event.provider} · Attempts: {event.attempt_count}</p>
          <p className="text-sm text-slate-500">Due: {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(event.available_at))}</p>
          {event.patient_id ? <Link className="text-sm text-sky-700 underline" href={`/dashboard/patients/${event.patient_id}`}>Open clinic patient folder</Link> : null}
          {event.status === "delivered" ? <p className="text-xs text-slate-500">Persisted in the clinic inbox. This does not indicate patient contact or staff read confirmation.</p> : null}
        </article>
      ))}
    </div>
  );
}
