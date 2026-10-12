import Link from "next/link";
import PageHeader from "@/components/dashboard/page-header";
import EmptyState from "@/components/shared/empty-state";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { cursorFilter, encodeCursor, PAGE_SIZE, scalar, type SearchParams } from "@/lib/pagination";
import { patientName, relation, type PatientIdentity } from "@/lib/patient-display";

type ConsultationRow = { id: string; patient_id: string; created_at: string | null; visit_date: string | null; chief_complaint: string | null; diagnosis: string | null; patient: PatientIdentity | null; doctor: { full_name: string } | null };

export default async function ConsultationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, profile } = await getClinicContext();
  let query = supabase.from("consultations")
    .select("id, patient_id, created_at, visit_date, chief_complaint, diagnosis, patient:patients!consultations_patient_id_fkey(first_name, last_name, other_names, hospital_number), doctor:users!consultations_doctor_id_fkey(full_name)")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  const filter = cursorFilter(scalar(params.cursor));
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load clinic consultations");
  const records = ((data ?? []) as unknown as ConsultationRow[]).slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Consultations" subtitle="Clinical notes and visit history across your clinic" />
      <Link href="/dashboard/appointments" className="inline-block rounded-xl bg-sky-600 px-5 py-3 font-medium text-white">Open today&apos;s queue</Link>
      {records.length === 0 ? <EmptyState title="No consultations recorded" description="Open a patient's folder to record a consultation. Completed notes will appear here." href="/dashboard/patients" label="Find a patient" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {records.map(record => {
            const patient = relation(record.patient), doctor = relation(record.doctor);
            return (
              <article key={record.id} className="min-w-0 rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><Link href={`/dashboard/patients/${record.patient_id}#consultations`} className="font-semibold text-sky-700 hover:underline">{patientName(patient)}</Link><p className="mt-1 text-sm text-slate-500">{patient?.hospital_number ?? "—"}</p></div>
                  <p className="text-sm text-slate-500">{record.visit_date ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(record.visit_date)) : "Date not recorded"}</p>
                </div>
                <dl className="mt-4 space-y-2 break-words text-sm"><div><dt className="font-medium">Chief complaint</dt><dd className="line-clamp-3 text-slate-600">{record.chief_complaint ?? "Not recorded"}</dd></div><div><dt className="font-medium">Diagnosis</dt><dd className="line-clamp-3 text-slate-600">{record.diagnosis ?? "Not recorded"}</dd></div></dl>
                <p className="mt-4 text-xs text-slate-500">Recorded by {doctor?.full_name ?? "Clinic staff"}</p>
              </article>
            );
          })}
        </div>
      )}
      <Pagination path="/dashboard/consultations" hasMore={(data?.length ?? 0) > PAGE_SIZE} cursor={records.length ? encodeCursor(records[records.length - 1]) : undefined} />
    </div>
  );
}
