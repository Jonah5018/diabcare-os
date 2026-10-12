export const roleLabels = {
  platform_owner: "Platform Owner",
  organization_admin: "Clinic Administrator",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  lab_scientist: "Laboratory Scientist",
} as const;

export type UserRole = keyof typeof roleLabels;
export type Permission = "patients:create" | "consultations:create" | "vitals:create" | "laboratory:create" | "appointments:create" | "appointments:update" | "reports:view" | "team:view";

const grants: Record<Permission, readonly UserRole[]> = {
  "patients:create": ["platform_owner", "organization_admin", "receptionist", "doctor", "nurse"],
  "consultations:create": ["platform_owner", "organization_admin", "doctor"],
  "vitals:create": ["platform_owner", "organization_admin", "doctor", "nurse"],
  "laboratory:create": ["platform_owner", "organization_admin", "lab_scientist"],
  "appointments:create": ["platform_owner", "organization_admin", "receptionist", "doctor"],
  "appointments:update": ["platform_owner", "organization_admin", "receptionist", "doctor", "nurse"],
  "reports:view": ["platform_owner", "organization_admin", "doctor"],
  "team:view": ["platform_owner", "organization_admin"],
};

export function can(role: UserRole, permission: Permission) {
  return grants[permission].includes(role);
}
