import Link from "next/link";
import AuditMetadata from "@/components/audit/audit-details";
import type { AuditRow } from "@/types/audit";

export default function AuditEvents({ rows, query }: { rows: AuditRow[]; query: Record<string, string> }) {
  const href = (field: "actor" | "record", value: string) =>
    `/dashboard/audit?${new URLSearchParams({ ...query, [field]: value })}`;
  return (
    <div className="space-y-3">
      {rows.map(event => (
        <article key={event.id} className="space-y-2 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold capitalize">{event.entity_type.replaceAll("_", " ")} · {event.operation.toLowerCase()}</h2>
            <time className="text-sm text-slate-500" dateTime={event.created_at}>
              {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(event.created_at))}
            </time>
          </div>
          <p className="text-sm text-slate-600">{event.actor?.full_name ?? "Actor not recorded"}</p>
          {event.actor_id ? <Link href={href("actor", event.actor_id)} className="block break-all text-xs text-sky-700 underline">Actor: {event.actor_id}</Link> : null}
          <Link href={href("record", event.record_id)} className="block break-all text-xs text-sky-700 underline">Record: {event.record_id}</Link>
          <AuditMetadata details={event.details} />
          {event.operation === "EXPORT" ? <p className="text-sm text-slate-500">Export requested; delivery is not confirmed.</p> : null}
          {event.operation === "ACCESS" ? <p className="text-sm text-slate-500">Private document access requested; download is not confirmed.</p> : null}
        </article>
      ))}
    </div>
  );
}
