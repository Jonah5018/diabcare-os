import ActionForm from "@/components/shared/action-form";
import { setStaffActivity } from "@/actions/staff";
import { roleLabels, type UserRole } from "@/lib/auth/permissions";
import StaffRoleForm from "@/components/onboarding/staff-role-form";

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean | null;
}

export default function StaffActivity({ staff, actorId, canChangeRoles = false }: {
  staff: StaffRow[];
  actorId: string;
  canChangeRoles?: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {staff.map(person => (
          <article key={person.id} className="space-y-4 rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">{person.full_name}</h2>
            <p className="text-sm text-slate-500">{roleLabels[person.role]} · {person.is_active ? "Active" : "Inactive"}</p>
            <p className="break-all text-sm">{person.email}</p>
            <p className="text-sm text-slate-500">{person.phone || "Phone not provided"}</p>
            {person.id !== actorId && person.role !== "platform_owner" ? (
              <ActionForm action={setStaffActivity}>
                <input type="hidden" name="staff_id" value={person.id} />
                <input type="hidden" name="active" value={person.is_active ? "false" : "true"} />
                <button className="rounded-lg border px-4 py-2 text-sm">{person.is_active ? "Deactivate" : "Reactivate"}</button>
              </ActionForm>
            ) : null}
            {canChangeRoles && person.id !== actorId && person.role !== "platform_owner" ? (
              <StaffRoleForm key={`${person.id}:${person.role}`} staffId={person.id} role={person.role} />
            ) : null}
          </article>
        ))}
      </div>
      {!staff.length ? <p className="text-sm text-slate-500">No staff records on this page.</p> : null}
      <p className="text-sm text-slate-500">Self, platform-owner and last active administrator accounts are protected. Inactive accounts remain inactive when their role changes.</p>
    </section>
  );
}
