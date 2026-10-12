import Link from "next/link";
import PageHeader from "@/components/dashboard/page-header";
import EmptyState from "@/components/shared/empty-state";
import Pagination from "@/components/shared/pagination";
import { getClinicContext } from "@/lib/auth/context";
import { cursorFilter, encodeCursor, PAGE_SIZE, scalar, type SearchParams } from "@/lib/pagination";
import { patientName, relation, type PatientIdentity } from "@/lib/patient-display";

type LabRow = { id: string; patient_id: string; created_at: string | null; hba1c: number | null; creatinine: number | null; total_cholesterol: number | null; patient: PatientIdentity | null; recorder: { full_name: string } | null };

export default async function LaboratoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, profile } = await getClinicContext();
  let query = supabase.from("laboratory_results")
    .select("id, patient_id, created_at, hba1c, creatinine, total_cholesterol, patient:patients!laboratory_results_patient_id_fkey(first_name, last_name, other_names, hospital_number), recorder:users!laboratory_results_recorded_by_fkey(full_name)")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  const filter = cursorFilter(scalar(params.cursor));
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load clinic laboratory results");
  const records = ((data ?? []) as unknown as LabRow[]).slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Laboratory" subtitle="Recorded patient results and laboratory history" />
      <Link href="/dashboard/patients" className="inline-block rounded-xl bg-violet-600 px-5 py-3 font-medium text-white">Find a patient to record results</Link>
      {records.length === 0 ? <EmptyState title="No laboratory results recorded" description="Record results in the patient's folder. Results remain part of their clinical history." /> : (
        <div className="grid gap-4 lg:grid-cols-2">{records.map(record => {
          const patient = relation(record.patient), recorder = relation(record.recorder);
          return (
            <article key={record.id} className="min-w-0 rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/dashboard/patients/${record.patient_id}#laboratory`} className="font-semibold text-violet-700 hover:underline">{patientName(patient)}</Link><p className="mt-1 text-sm text-slate-500">{patient?.hospital_number ?? "—"}</p></div><p className="text-sm text-slate-500">{record.created_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(record.created_at)) : "Date not recorded"}</p></div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">{[["HbA1c", record.hba1c, "%"], ["Creatinine", record.creatinine, "µmol/L"], ["Total cholesterol", record.total_cholesterol, "mmol/L"]].map(([label, value, unit]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold">{value === null ? "Not recorded" : `${value} ${unit}`}</dd></div>)}</dl>
              <p className="mt-4 text-xs text-slate-500">Recorded by {recorder?.full_name ?? "Clinic staff"}</p>
            </article>
          );
        })}</div>
      )}
      <Pagination path="/dashboard/laboratory" hasMore={(data?.length ?? 0) > PAGE_SIZE} cursor={records.length ? encodeCursor(records[records.length - 1]) : undefined} />
    </div>
  );
}
