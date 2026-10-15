import AdministrationForm from "@/components/onboarding/administration-form";
import { inviteStaff } from "@/actions/staff";
import { inviteRoles } from "@/lib/validations/onboarding";
import { roleLabels } from "@/lib/auth/permissions";

export default function InviteForm({ clinicId }: { clinicId: string }) {
  return (
    <AdministrationForm action={inviteStaff}>
      <h3 className="font-semibold">Invite staff</h3>
      <input type="hidden" name="clinic_id" value={clinicId} />
      <label htmlFor={`${clinicId}-invite-name`} className="block text-sm font-medium">Full name</label>
      <input id={`${clinicId}-invite-name`} name="full_name" required maxLength={200} className="w-full rounded-lg border p-3" />
      <label htmlFor={`${clinicId}-invite-email`} className="block text-sm font-medium">Email</label>
      <input id={`${clinicId}-invite-email`} name="email" type="email" required maxLength={254} className="w-full rounded-lg border p-3" />
      <label htmlFor={`${clinicId}-invite-role`} className="block text-sm font-medium">Clinic role</label>
      <select id={`${clinicId}-invite-role`} name="role" defaultValue="doctor" className="w-full rounded-lg border p-3">
        {inviteRoles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
      </select>
      <button className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white">Issue invitation</button>
    </AdministrationForm>
  );
}
