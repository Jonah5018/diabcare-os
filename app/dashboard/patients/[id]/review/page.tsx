import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClinicalReview } from "@/lib/clinical-review/queries";
import PageHeader from "@/components/dashboard/page-header";
import AccessDenied from "@/components/shared/access-denied";
import ClinicalReview from "@/components/clinical-review/clinical-review";

export const metadata: Metadata = { title: "Clinical review" };

export default async function ClinicalReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { profile } = await getClinicContext();
  if (!can(profile.role, "clinical-review:view")) return <AccessDenied />;

  const review = await getClinicalReview(id);
  if (!review) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Clinical review"
          subtitle={`${review.patient.last_name} ${review.patient.first_name} · ${review.patient.hospital_number}`}
          eyebrow="PATIENT / CLINICIAN WORKSPACE"
        />
        <Link
          href={`/dashboard/patients/${id}`}
          prefetch={false}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-700"
        >
          Back to patient folder
        </Link>
      </div>
      <ClinicalReview review={review} />
    </div>
  );
}
