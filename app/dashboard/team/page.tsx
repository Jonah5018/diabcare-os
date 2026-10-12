import AccessDenied from "@/components/shared/access-denied";
import { can } from "@/lib/auth/permissions";
import PageHeader from "@/components/dashboard/page-header";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { roleLabels, type UserRole } from "@/lib/auth/permissions";
import { cursorFilter, encodeCursor, PAGE_SIZE, scalar, type SearchParams } from "@/lib/pagination";

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "team:view")) return <AccessDenied />;
  let query = supabase.from("users").select("id, full_name, email, phone, role, is_active, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  const filter = cursorFilter(scalar(params.cursor));
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load your clinic team");
  const staff = (data ?? []).slice(0, PAGE_SIZE);

  return <div className="space-y-6"><PageHeader title="Clinic Team" subtitle="Staff assigned to your clinic and their access roles" /><div className="grid gap-4 lg:grid-cols-2">{staff.map(person => <article key={person.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{person.full_name}</h2><p className="mt-1 text-sm text-slate-500">{roleLabels[person.role as UserRole] ?? "Staff"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${person.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{person.is_active ? "Active" : "Inactive"}</span></div><p className="mt-4 break-all text-sm text-slate-600">{person.email}</p><p className="mt-1 text-sm text-slate-500">{person.phone || "Phone not provided"}</p></article>)}</div><Pagination path="/dashboard/team" hasMore={(data?.length ?? 0) > PAGE_SIZE} cursor={staff.length ? encodeCursor(staff[staff.length - 1]) : undefined} /><p className="text-sm text-slate-500">Role changes and staff invitations are managed by your clinic administrator.</p></div>;
}
