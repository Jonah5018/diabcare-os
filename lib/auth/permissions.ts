export const roleLabels = {
  platform_owner: "Platform Owner",
  organization_admin: "Clinic Administrator",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  lab_scientist: "Laboratory Scientist",
} as const;

export type UserRole = keyof typeof roleLabels;
export type Permission =
  | "patients:create"
  | "consultations:create"
  | "vitals:create"
  | "laboratory:create"
  | "appointments:create"
  | "appointments:update"
  | "reports:view"
  | "team:view"
  | "prescriptions:create"
  | "prescriptions:update"
  | "follow-ups:create"
  | "follow-ups:update"
  | "clinics:create"
  | "clinic:update"
  | "team:manage"
  | "team:roles"
  | "audit:export"
  | "documents:view"
  | "documents:upload"
  | "notifications:view"
  | "notifications:manage"
  | "billing:view"
  | "platform:view"
  | "platform:manage";

const grants: Record<Permission, readonly UserRole[]> = {
  "patients:create": ["platform_owner", "organization_admin", "receptionist", "doctor", "nurse"],
  "consultations:create": ["platform_owner", "organization_admin", "doctor"],
  "vitals:create": ["platform_owner", "organization_admin", "doctor", "nurse"],
  "laboratory:create": ["platform_owner", "organization_admin", "lab_scientist"],
  "appointments:create": ["platform_owner", "organization_admin", "receptionist", "doctor"],
  "appointments:update": ["platform_owner", "organization_admin", "receptionist", "doctor", "nurse"],
  "reports:view": ["platform_owner", "organization_admin", "doctor"],
  "team:view": ["platform_owner", "organization_admin"],
  "prescriptions:create": ["platform_owner", "organization_admin", "doctor"],
  "prescriptions:update": ["platform_owner", "organization_admin", "doctor"],
  "follow-ups:create": ["platform_owner", "organization_admin", "doctor"],
  "follow-ups:update": ["platform_owner", "organization_admin", "doctor"],
  "clinics:create": ["platform_owner"],
  "clinic:update": ["platform_owner", "organization_admin"],
  "team:manage": ["platform_owner", "organization_admin"],
  "team:roles": ["platform_owner", "organization_admin"],
  "audit:export": ["platform_owner", "organization_admin"],
  "documents:view": ["platform_owner", "organization_admin", "doctor", "nurse", "lab_scientist", "receptionist"],
  "documents:upload": ["platform_owner", "organization_admin", "doctor", "nurse", "lab_scientist"],
  "notifications:view": ["platform_owner", "organization_admin", "doctor", "nurse", "lab_scientist", "receptionist"],
  "notifications:manage": ["platform_owner", "organization_admin"],
  "billing:view": ["platform_owner", "organization_admin"],
  "platform:view": ["platform_owner"],
  "platform:manage": ["platform_owner"],
};

export function can(role: UserRole, permission: Permission) {
  return grants[permission].includes(role);
}

export const permissionLabels: Record<Permission, string> = {
  "patients:create": "Register patients",
  "consultations:create": "Record consultations",
  "vitals:create": "Record vitals",
  "laboratory:create": "Record laboratory results",
  "appointments:create": "Book appointments",
  "appointments:update": "Manage appointment lifecycle",
  "reports:view": "View operational reports",
  "team:view": "View clinic team and audit",
  "prescriptions:create": "Create prescriptions",
  "prescriptions:update": "Resolve prescriptions",
  "follow-ups:create": "Plan follow-ups",
  "follow-ups:update": "Resolve follow-ups",
  "clinics:create": "Provision clinics (platform only)",
  "clinic:update": "Edit clinic profile",
  "team:manage": "Manage invitations and staff activity",
  "team:roles": "Assign clinic staff roles",
  "audit:export": "Export bounded clinic audit history",
  "documents:view": "View private patient documents",
  "documents:upload": "Upload patient documents",
  "notifications:view": "Read internal clinic notifications",
  "notifications:manage": "Queue and process clinic notifications",
  "billing:view": "View clinic billing configuration",
  "platform:view": "View global platform metadata",
  "platform:manage": "Manage clinic operational status and billing bindings",
};
