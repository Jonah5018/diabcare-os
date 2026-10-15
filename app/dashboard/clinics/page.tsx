import Link from "next/link";
import { z } from "zod";
import PageHeader from "@/components/dashboard/page-header";
import AccessDenied from "@/components/shared/access-denied";
import AdministrationForm from "@/components/onboarding/administration-form";
import { provisionClinic } from "@/actions/clinic";
import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { scalar, type SearchParams } from "@/lib/pagination";

export default async function ClinicsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await getClinicContext();
  if (!can(profile.role, "clinics:create")) return <AccessDenied />;
  const params = await searchParams;
  const after = scalar(params.after);
  if (after && !z.uuid().safeParse(after).success) throw new Error("Invalid clinic cursor");
  const { data, error } = await supabase.rpc("list_onboarding_clinics", { p_after: after || null });
  if (error) throw new Error("Unable to load onboarding clinics");
  const rows = ((data ?? []) as { id: string; name: string; slug: string }[]).slice(0, 25);
  const last = rows.at(-1);

  return (
    <div className="space-y-6">
      <PageHeader title="Clinic Onboarding" subtitle="Platform-owner controlled clinic creation" />
      <AdministrationForm action={provisionClinic}>
        <h2 className="font-semibold">Create clinic and initial administrator invitation</h2>
        {[
          ["name", "Clinic name", "text", 200],
          ["slug", "Clinic slug", "text", 80],
          ["admin_name", "Initial administrator name", "text", 200],
          ["admin_email", "Initial administrator email", "email", 254],
        ].map(([key, label, type, maximum]) => <div key={String(key)}>
          <label htmlFor={`clinic-${key}`} className="mb-1 block text-sm font-medium">{label}</label>
          <input id={`clinic-${key}`} name={String(key)} type={String(type)} maxLength={Number(maximum)} required className="w-full rounded-lg border p-3" />
        </div>)}
        <p className="text-sm text-slate-500">Use a unique lowercase slug such as diabcare-test-clinic. Creating a clinic does not move your current account. The named administrator joins only after verified acceptance.</p>
        <button className="rounded-lg bg-sky-600 px-4 py-2 text-white">Create clinic</button>
      </AdministrationForm>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(clinic => <article key={clinic.id} className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">{clinic.name}</h2>
          <p className="text-sm text-slate-500">{clinic.slug}</p>
          <Link href={`/dashboard/clinics/${clinic.id}`} className="mt-3 inline-block text-sky-700 underline">Manage invitations</Link>
        </article>)}
      </div>
      <nav className="flex flex-wrap gap-4" aria-label="Clinic pagination">
        <Link href="/dashboard/clinics" className="text-sky-700 underline">First clinics</Link>
        {(data?.length ?? 0) > 25 && last ? <Link href={`?after=${last.id}`} className="text-sky-700 underline">Next clinics</Link> : null}
      </nav>
    </div>
  );
}
