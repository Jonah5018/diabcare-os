import { roleLabels, type UserRole } from "@/lib/auth/permissions";
import type { AuditDetails } from "@/types/audit";

export type { AuditDetails } from "@/types/audit";

function roleName(role: string) {
  return Object.hasOwn(roleLabels, role) ? roleLabels[role as UserRole] : "Staff role";
}

function activityName(active: boolean | null | undefined) {
  return active === true ? "Active" : active === false ? "Inactive" : "Not recorded";
}

export default function AuditMetadata({ details }: { details: AuditDetails }) {
  return (
    <dl className="mt-3 space-y-2 text-sm text-slate-600">
      {details.status ? (
        <div>
          <dt className="font-medium">Status</dt>
          <dd className="capitalize">{details.previous_status ? `${details.previous_status.replaceAll("_", " ")} → ` : ""}{details.status.replaceAll("_", " ")}</dd>
        </div>
      ) : null}
      {details.role ? (
        <div>
          <dt className="font-medium">Role</dt>
          <dd>{details.previous_role ? `${roleName(details.previous_role)} → ` : ""}{roleName(details.role)}</dd>
        </div>
      ) : null}
      {Object.hasOwn(details, "is_active") ? (
        <div>
          <dt className="font-medium">Account activity</dt>
          <dd>{Object.hasOwn(details, "previous_is_active") ? `${activityName(details.previous_is_active)} → ` : ""}{activityName(details.is_active)}</dd>
        </div>
      ) : null}
    </dl>
  );
}
