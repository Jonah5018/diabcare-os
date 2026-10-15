import ActionForm from "@/components/shared/action-form";
import { changeStaffRole } from "@/actions/staff-role";
import { inviteRoles } from "@/lib/validations/onboarding";
import { roleLabels, type UserRole } from "@/lib/auth/permissions";

export default function StaffRoleForm({ staffId, role }: { staffId: string; role: UserRole }) {
  if (role === "platform_owner") return null;

  return (
    <ActionForm action={changeStaffRole} className="space-y-3 border-t pt-4">
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="expected_role" value={role} />
      <label htmlFor={`staff-role-${staffId}`} className="block text-sm font-medium">Assign clinic role</label>
      <select id={`staff-role-${staffId}`} name="role" defaultValue={role} className="w-full rounded-lg border p-3">
        {inviteRoles.map(value => <option key={value} value={value}>{roleLabels[value]}</option>)}
      </select>
      <p className="text-xs text-slate-500">The role controls future access. Clinical history and staff activity are preserved.</p>
      <button className="rounded-lg border px-4 py-2 text-sm font-medium">Save role</button>
    </ActionForm>
  );
}
