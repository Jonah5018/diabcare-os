import FollowUpForm from "@/components/follow-ups/follow-up-form";
import FollowUpList from "@/components/follow-ups/follow-up-list";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClinicToday } from "@/lib/clinic-date";
import { getFollowUpHistory } from "@/lib/follow-ups/history";
import { encodeCursor } from "@/lib/pagination";

export default async function FollowUpModule({ patientId, cursor, query }: {
  patientId: string;
  cursor: string;
  query: Record<string, string>;
}) {
  const { profile, user } = await getClinicContext();
  const history = await getFollowUpHistory(patientId, cursor).catch(() => null);
  const last = history?.rows.at(-1);
  const today = getClinicToday();

  return (
    <section id="follow-ups" className="scroll-mt-20 space-y-4 rounded-2xl border bg-slate-50 p-4 sm:p-6">
      <h3 className="text-lg font-semibold">Follow-up Plans</h3>
      {can(profile.role, "follow-ups:create") ? <FollowUpForm patientId={patientId} today={today} /> : null}
      {history ? (
        <>
          <FollowUpList rows={history.rows} today={today} userId={user.id}
            canUpdate={can(profile.role, "follow-ups:update")}
            administrator={profile.role === "organization_admin" || profile.role === "platform_owner"} />
          <Pagination path={`/dashboard/patients/${patientId}`} query={query} parameter="followUpCursor"
            hasMore={history.hasMore} cursor={last ? encodeCursor(last) : undefined} />
        </>
      ) : <p role="alert" className="text-sm text-rose-700">Unable to load follow-up history. Refresh the patient folder or clear its follow-up cursor to try again.</p>}
    </section>
  );
}
