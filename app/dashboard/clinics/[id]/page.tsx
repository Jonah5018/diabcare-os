import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import PageHeader from "@/components/dashboard/page-header";
import AccessDenied from "@/components/shared/access-denied";
import InviteForm from "@/components/onboarding/invite-form";
import InvitationHistory from "@/components/onboarding/invitation-history";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { scalar, type SearchParams } from "@/lib/pagination";

export default async function ClinicInvitationsPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: SearchParams;
}) {
  const { profile } = await getClinicContext();
  if (!can(profile.role, "clinics:create")) return <AccessDenied />;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader title="Clinic Invitations" subtitle="Platform owner administration; your current membership stays unchanged" />
      <InviteForm clinicId={id} />
      <Suspense fallback={<p role="status">Loading invitations...</p>}>
        <InvitationHistory clinicId={id} cursor={scalar(query.invitationCursor)} path={`/dashboard/clinics/${id}`} />
      </Suspense>
    </div>
  );
}
