import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import PageHeader from "@/components/dashboard/page-header";
import AccessDenied from "@/components/shared/access-denied";
import PrescriptionForm from "@/components/prescriptions/prescription-form";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClinicToday } from "@/lib/clinic-date";

export default async function NewPrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "prescriptions:create")) return <AccessDenied />;

  const { data: consultation, error } = await supabase.from("consultations")
    .select("id, patient_id, visit_date, chief_complaint, diagnosis")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (error) throw new Error("Unable to load the consultation");
  if (!consultation) notFound();

  const { data: patient, error: patientError } = await supabase.from("patients")
    .select("first_name, last_name, hospital_number")
    .eq("id", consultation.patient_id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (patientError) throw new Error("Unable to load the patient");
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="New Prescription" subtitle={`${patient.last_name} ${patient.first_name} · ${patient.hospital_number}`} />
      <section className="space-y-3 rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Linked consultation</h2>
        <p className="break-words text-sm"><strong>Chief complaint:</strong> {consultation.chief_complaint || "Not recorded"}</p>
        <p className="break-words text-sm"><strong>Diagnosis:</strong> {consultation.diagnosis || "Not recorded"}</p>
        <p className="text-sm text-slate-500">You are the prescribing actor. Enter clinician-selected medication details; the platform does not recommend doses.</p>
        <Link href={`/dashboard/patients/${consultation.patient_id}#prescriptions`} className="text-sky-700 underline">
          Review patient history
        </Link>
      </section>
      <PrescriptionForm patientId={consultation.patient_id} consultationId={id} today={getClinicToday()} />
    </div>
  );
}
