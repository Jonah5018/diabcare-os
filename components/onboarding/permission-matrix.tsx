import { can, permissionLabels, roleLabels, type Permission, type UserRole } from "@/lib/auth/permissions";

export default function PermissionMatrix() {
  const roles = Object.keys(roleLabels) as UserRole[];
  const permissions = Object.keys(permissionLabels) as Permission[];

  return (
    <details className="rounded-2xl border bg-white p-5">
      <summary className="cursor-pointer font-semibold">Role capability matrix</summary>
      <p className="my-4 text-sm text-slate-500">
        Predefined capabilities are enforced by server actions and database rules.
        Active staff can read clinical records within their clinic. Doctor ownership restrictions and protected-account rules also apply.
        Changing a role does not grant platform authority or move a clinic membership.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">Predefined clinic role capabilities</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b p-3 text-left">Capability</th>
              {roles.map(role => <th key={role} scope="col" className="border-b p-3 text-left">{roleLabels[role]}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissions.map(permission => (
              <tr key={permission}>
                <th scope="row" className="border-b p-3 text-left font-medium">{permissionLabels[permission]}</th>
                {roles.map(role => <td key={role} className="border-b p-3">{can(role, permission) ? "Allowed" : "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
