import AccessDenied from "@/components/shared/access-denied";
import { can } from "@/lib/auth/permissions";
import PageHeader from "@/components/dashboard/page-header";
import EmptyState from "@/components/shared/empty-state";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { cursorFilter, encodeCursor, PAGE_SIZE, scalar, type SearchParams } from "@/lib/pagination";

type AuditRow = { id: string; created_at: string; entity_type: string; operation: string; details: { status?: string; previous_status?: string }; actor: { full_name: string } | null };

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "team:view")) return <AccessDenied />;
  let query = supabase.from("audit_events").select("id, created_at, entity_type, operation, details, actor:users!audit_events_actor_id_fkey(full_name)")
    .eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  const filter = cursorFilter(scalar(params.cursor));
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load clinic audit history");
  const events = ((data ?? []) as unknown as AuditRow[]).slice(0, PAGE_SIZE);
  return <div className="space-y-6"><PageHeader title="Audit History" subtitle="Record creation, updates, and appointment status changes in your clinic" /><p className="text-sm text-slate-500">Events are recorded from the date audit history was enabled. Clinical notes and measurement values are excluded.</p>{events.length === 0 ? <EmptyState title="No audit events yet" description="New patient records, clinical records, and appointment changes will appear here." /> : <div className="space-y-3">{events.map(event => <article key={event.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold capitalize">{event.entity_type.replaceAll("_", " ")} · {event.operation.toLowerCase()}</h2><p className="text-sm text-slate-500">{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(event.created_at))}</p></div><p className="mt-2 text-sm text-slate-600">{event.actor?.full_name ?? "System operation"}</p>{event.details.status ? <p className="mt-1 text-sm capitalize text-slate-500">{event.details.previous_status ? `${event.details.previous_status.replaceAll("_", " ")} → ` : ""}{event.details.status.replaceAll("_", " ")}</p> : null}</article>)}</div>}<Pagination path="/dashboard/audit" hasMore={(data?.length ?? 0) > PAGE_SIZE} cursor={events.length ? encodeCursor(events[events.length - 1]) : undefined} /></div>;
}
