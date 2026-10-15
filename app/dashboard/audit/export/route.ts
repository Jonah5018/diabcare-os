import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { auditFilters } from "@/lib/audit/filters";
import { getAuditPage } from "@/lib/audit/queries";
import { auditCsv } from "@/lib/audit/csv";
import { encodeCursor } from "@/lib/pagination";

export async function POST(request: Request) {
  // Export requests mutate audit history; reject cross-origin browser requests.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response("Export must be requested from this application.", { status: 403 });
  }
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "audit:export")) return new Response("Audit export permission denied.", { status: 403 });
  try {
    const body = await request.formData();
    const params = Object.fromEntries(["from", "to", "actor", "record", "entity", "operation", "cursor"]
      .map(key => [key, typeof body.get(key) === "string" ? String(body.get(key)) : ""]));
    const filters = auditFilters(params);
    const page = await getAuditPage(filters, true);
    const { error } = await supabase.rpc("record_audit_export_request", {
      p_from: filters.from, p_to: filters.to, p_count: page.rows.length,
    });
    if (error) throw new Error("Audit request could not be recorded");
    const headers = new Headers({
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="clinic-audit-page.csv"', "X-Content-Type-Options": "nosniff",
      "X-Audit-Has-More": String(page.hasMore),
    });
    const last = page.rows.at(-1);
    if (page.hasMore && last) headers.set("X-Audit-Next-Cursor", encodeCursor(last));
    return new Response(auditCsv(page.rows), { headers });
  } catch {
    return new Response("Unable to export this page. Check the filters and refresh audit history before retrying.", {
      status: 400, headers: { "Cache-Control": "no-store" },
    });
  }
}
