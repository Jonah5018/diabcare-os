import PageHeader from "@/components/dashboard/page-header";
import { getClinicContext } from "@/lib/auth/context";
import { roleLabels } from "@/lib/auth/permissions";
import { signOut } from "@/actions/auth";

export default async function SettingsPage() {
  const { supabase, profile } = await getClinicContext();
  const { data: clinic, error } = await supabase.from("organizations")
    .select("name, email, phone, address, subscription_status").eq("id", profile.organization_id).single();
  if (error || !clinic) throw new Error("Unable to load clinic settings");

  const sections = [
    { title: "Your account", values: [["Full name", profile.full_name], ["Email", profile.email], ["Phone", profile.phone], ["Role", roleLabels[profile.role]]] },
    { title: "Clinic workspace", values: [["Clinic", clinic.name], ["Email", clinic.email], ["Phone", clinic.phone], ["Address", clinic.address], ["Subscription", clinic.subscription_status], ["Clinic timezone", "Africa/Lagos"]] },
  ];
  return <div className="space-y-6"><PageHeader title="Settings" subtitle="Your account and clinic workspace details" /><div className="grid gap-6 lg:grid-cols-2">{sections.map(section => <section key={section.title} className="rounded-2xl border bg-white p-6"><h2 className="mb-5 text-lg font-semibold">{section.title}</h2><dl className="space-y-4">{section.values.map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900">{value || "Not provided"}</dd></div>)}</dl></section>)}</div><section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Session</h2><p className="mt-2 text-sm text-slate-500">Sign out when you finish working on a shared clinic computer.</p><form action={signOut}><button className="mt-4 rounded-xl border px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Sign out of this device</button></form></section></div>;
}
