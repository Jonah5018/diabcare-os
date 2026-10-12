import Link from "next/link";
import { Plus } from "lucide-react";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { PAGE_SIZE, cursorFilter, encodeCursor, scalar, searchTerms, type SearchParams } from "@/lib/pagination";
import PageHeader from "@/components/dashboard/page-header";
import PatientTable from "@/components/patients/patient-table";
import Pagination from "@/components/shared/pagination";

export default async function PatientsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = scalar(params.q).slice(0, 80);
  const { supabase, profile } = await getClinicContext();
  let query = supabase.from("patients")
    .select("id, hospital_number, first_name, other_names, last_name, gender, phone, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  for (const term of searchTerms(search)) {
    query = query.ilike("search_text", `%${term}%`);
  }
  const filter = cursorFilter(scalar(params.cursor));
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load clinic patients");
  const patients = (data ?? []).slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader title="Patients" subtitle="Search and manage your clinic's patient records" />
        {can(profile.role, "patients:create") ? <Link href="/dashboard/patients/new" className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 font-medium text-white"><Plus className="h-5 w-5" />New Patient</Link> : null}
      </div>
      <PatientTable patients={patients} search={search} />
      <Pagination path="/dashboard/patients" hasMore={(data?.length ?? 0) > PAGE_SIZE} cursor={patients.length ? encodeCursor(patients[patients.length - 1]) : undefined} query={{ q: search }} />
    </div>
  );
}
