import Link from "next/link";
import PageHeader from "@/components/dashboard/page-header";
import FollowUpList from "@/components/follow-ups/follow-up-list";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClinicToday } from "@/lib/clinic-date";
import { getClinicFollowUps } from "@/lib/follow-ups/history";
import { encodeDueCursor } from "@/lib/follow-ups/pagination";
import { scalar, type SearchParams } from "@/lib/pagination";

export default async function FollowUpsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const window = scalar(params.window) === "overdue" ? "overdue" : "upcoming";
  const { profile, user } = await getClinicContext();
  const history = await getClinicFollowUps(window, scalar(params.cursor)).catch(() => null);
  const last = history?.rows.at(-1);

  return (
    <div className="space-y-6">
      <PageHeader title="Follow-ups and Recalls" subtitle="Review planned care across your clinic" />
      <p className="text-sm text-slate-500">Overdue plans are a recall review list. Staff resolve plans after reviewing care; booking and appointment completion do not resolve them automatically. Reminder delivery is not enabled.</p>
      <nav aria-label="Follow-up lists" className="flex flex-wrap gap-3">
        <Link href="?window=upcoming" aria-current={window === "upcoming" ? "page" : undefined} className="rounded-xl border bg-white px-4 py-2">Upcoming and today</Link>
        <Link href="?window=overdue" aria-current={window === "overdue" ? "page" : undefined} className="rounded-xl border bg-white px-4 py-2">Overdue recall review</Link>
        <Link href="/dashboard/patients" className="rounded-xl border bg-white px-4 py-2">Open patient folders</Link>
      </nav>
      {history ? (
        <>
          <FollowUpList rows={history.rows} today={getClinicToday()} userId={user.id}
            canUpdate={can(profile.role, "follow-ups:update")}
            administrator={profile.role === "organization_admin" || profile.role === "platform_owner"} />
          <nav aria-label="Follow-up pagination" className="flex flex-wrap justify-between gap-3 text-sm">
            <Link href={`?window=${window}`} className="rounded-lg border bg-white px-4 py-2">First plans</Link>
            {history.hasMore && last ? <Link href={`?window=${window}&cursor=${encodeDueCursor(last)}`} className="rounded-lg bg-sky-600 px-4 py-2 text-white">Next plans</Link> : <p className="text-slate-500">End of results</p>}
          </nav>
        </>
      ) : <p role="alert" className="text-sm text-rose-700">Unable to load these plans. Open the first page or refresh to try again.</p>}
    </div>
  );
}
