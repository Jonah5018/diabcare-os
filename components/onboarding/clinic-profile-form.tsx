import AdministrationForm from "@/components/onboarding/administration-form";
import { updateClinicProfile } from "@/actions/clinic";

export default function ClinicProfileForm({ clinic }: {
  clinic: { name: string; email: string | null; phone: string | null; address: string | null };
}) {
  return (
    <AdministrationForm action={updateClinicProfile}>
      <h2 className="font-semibold">Edit clinic profile</h2>
      {(["name", "email", "phone", "address"] as const).map(field => (
        <div key={field}>
          <label htmlFor={`clinic-profile-${field}`} className="mb-1 block text-sm font-medium capitalize">{field}</label>
          <input id={`clinic-profile-${field}`} name={field} type={field === "email" ? "email" : "text"}
            defaultValue={clinic[field] ?? ""} required={field === "name"}
            maxLength={field === "name" ? 200 : field === "email" ? 254 : field === "phone" ? 40 : 500}
            className="w-full rounded-lg border p-3" />
        </div>
      ))}
      <p className="text-xs text-slate-500">Clinic slug, subscription and account roles are not changed here.</p>
      <button className="rounded-lg bg-sky-600 px-4 py-2 text-white">Save clinic profile</button>
    </AdministrationForm>
  );
}
