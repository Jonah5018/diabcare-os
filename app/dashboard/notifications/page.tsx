import AccessDenied from "@/components/shared/access-denied";
import PageHeader from "@/components/dashboard/page-header";
import Pagination from "@/components/shared/pagination";
import NotificationControls from "@/components/notifications/notification-controls";
import NotificationList from "@/components/notifications/notification-list";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getNotifications } from "@/lib/notifications/queries";
import { encodeCursor, scalar, type SearchParams } from "@/lib/pagination";

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await getClinicContext();
  if (!can(profile.role, "notifications:view")) return <AccessDenied />;
  const params = await searchParams;
  const manage = can(profile.role, "notifications:manage");
  const page = await getNotifications(scalar(params.cursor), manage).catch(() => null);
  const last = page?.rows.at(-1);

  return (
    <div className="space-y-6">
      <PageHeader title="Clinic Notifications" subtitle={manage ? "Durable notification events and clinic inbox delivery" : "Your clinic's internal notification inbox"} />
      {manage ? <NotificationControls /> : null}
      {page ? <>
        <NotificationList rows={page.rows} />
        <Pagination path="/dashboard/notifications" hasMore={page.hasMore} cursor={last ? encodeCursor(last) : undefined} />
      </> : <p role="alert" className="text-rose-700">Unable to load notifications. Refresh or clear the cursor.</p>}
    </div>
  );
}
