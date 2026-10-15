import ActionForm from "@/components/shared/action-form";
import Pagination from "@/components/shared/pagination";
import { revokeInvitation } from "@/actions/staff";
import { getClinicContext } from "@/lib/auth/context";
import { encodeCursor } from "@/lib/pagination";
import { z } from "zod";
import type { StaffInvitation } from "@/types/onboarding";

export default async function InvitationHistory({ clinicId, cursor, path, query = {} }: {
  clinicId: string; cursor: string; path: string; query?: Record<string, string>;
}) {
  let before: { id: string; created_at: string } | null = null;
  if (cursor) {
    try {
      if (cursor.length > 400) throw new Error("Invalid cursor");
      before = z.object({ id: z.uuid(), created_at: z.iso.datetime({ offset: true }) })
        .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    } catch {
      return <p role="alert">Invalid invitation history cursor. Open the first page to try again.</p>;
    }
  }
  const { supabase } = await getClinicContext();
  const { data, error } = await supabase.rpc("list_clinic_invitations", {
    p_clinic: clinicId, p_before_time: before?.created_at ?? null, p_before_id: before?.id ?? null,
  });
  if (error) return <p role="alert">Unable to load invitation history.</p>;
  const rows = ((data ?? []) as StaffInvitation[]).slice(0, 25);
  const last = rows.at(-1);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Invitation history</h2>
      {rows.length ? rows.map(invitation => (
        <article key={invitation.id} className="space-y-3 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">{invitation.full_name}</h3>
          <p className="break-all text-sm">{invitation.email}</p>
          <p className="text-sm capitalize">{invitation.role.replaceAll("_", " ")} · {invitation.status === "pending" && new Date(invitation.expires_at) <= new Date() ? "Expired" : invitation.status}</p>
          <p className="text-xs text-slate-500">Expires {new Date(invitation.expires_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} (Lagos)</p>
          {invitation.status === "pending" ? (
            <ActionForm action={revokeInvitation}>
              <input type="hidden" name="invitation_id" value={invitation.id} />
              <button className="rounded-lg border px-4 py-2 text-sm text-rose-700">Revoke invitation</button>
            </ActionForm>
          ) : null}
        </article>
      )) : <p className="text-sm text-slate-500">No invitations recorded.</p>}
      <Pagination path={path} query={query} parameter="invitationCursor" hasMore={(data?.length ?? 0) > 25}
        cursor={last ? encodeCursor(last) : undefined} />
    </section>
  );
}
