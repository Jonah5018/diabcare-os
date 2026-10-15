import AccessDenied from "@/components/shared/access-denied";
import { Suspense } from "react";
import InviteForm from "@/components/onboarding/invite-form";
import InvitationHistory from "@/components/onboarding/invitation-history";
import StaffActivity from "@/components/onboarding/staff-activity";
import PermissionMatrix from "@/components/onboarding/permission-matrix";
import { can } from "@/lib/auth/permissions";
import PageHeader from "@/components/dashboard/page-header";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { cursorFilter, encodeCursor, PAGE_SIZE, scalar, type SearchParams } from "@/lib/pagination";

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, profile, user } = await getClinicContext();
  if (!can(profile.role, "team:view")) return <AccessDenied />;
  let query = supabase.from("users").select("id, full_name, email, phone, role, is_active, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  const filter = cursorFilter(scalar(params.cursor));
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load your clinic team");
  const staff = (data ?? []).slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Clinic Team" subtitle="Staff assigned to your clinic and their access roles" />
      <InviteForm clinicId={profile.organization_id} />
      <StaffActivity staff={staff} actorId={user.id} canChangeRoles={can(profile.role, "team:roles")} />
      <PermissionMatrix />
      <Pagination path="/dashboard/team" query={{ invitationCursor: scalar(params.invitationCursor) }}
        hasMore={(data?.length ?? 0) > PAGE_SIZE} cursor={staff.length ? encodeCursor(staff[staff.length - 1]) : undefined} />
      <Suspense fallback={<p role="status">Loading invitation history...</p>}>
        <InvitationHistory clinicId={profile.organization_id} cursor={scalar(params.invitationCursor)}
          path="/dashboard/team" query={{ cursor: scalar(params.cursor) }} />
      </Suspense>
    </div>
  );

}
