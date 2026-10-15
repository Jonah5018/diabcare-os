import { can, type Permission, type UserRole } from "@/lib/auth/permissions";

type WorkspaceLink = {
  name: string;
  href: string;
  section: "Care workspace" | "Workspace" | "Administration";
  permission?: Permission;
};

const links: readonly WorkspaceLink[] = [
  { name: "Dashboard", href: "/dashboard", section: "Care workspace" },
  { name: "Patients", href: "/dashboard/patients", section: "Care workspace" },
  { name: "Appointments", href: "/dashboard/appointments", section: "Care workspace" },
  { name: "Follow-ups", href: "/dashboard/follow-ups", section: "Care workspace" },
  { name: "Consultations", href: "/dashboard/consultations", section: "Care workspace" },
  { name: "Laboratory", href: "/dashboard/laboratory", section: "Care workspace" },
  { name: "Notifications", href: "/dashboard/notifications", section: "Workspace", permission: "notifications:view" },
  { name: "Reports", href: "/dashboard/reports", section: "Workspace", permission: "reports:view" },
  { name: "Settings", href: "/dashboard/settings", section: "Workspace" },
  { name: "Team", href: "/dashboard/team", section: "Administration", permission: "team:view" },
  { name: "Audit History", href: "/dashboard/audit", section: "Administration", permission: "team:view" },
  { name: "Billing", href: "/dashboard/billing", section: "Administration", permission: "billing:view" },
  { name: "Clinic Onboarding", href: "/dashboard/clinics", section: "Administration", permission: "clinics:create" },
  { name: "Platform Administration", href: "/platform", section: "Administration", permission: "platform:view" },
];

export function navigationForRole(role: UserRole) {
  return links.filter(link => !link.permission || can(role, link.permission));
}

export const workspaceGuidance: Record<UserRole, { label: string; description: string }> = {
  receptionist: { label: "Reception desk", description: "Keep arrivals organized and help each patient reach the right next step." },
  nurse: { label: "Clinical coordination", description: "Review the queue, select a patient and keep recorded measurements connected to their visit." },
  doctor: { label: "Care workspace", description: "Pick up the patient journey, document the consultation and plan the next review." },
  lab_scientist: { label: "Laboratory workspace", description: "Find the right patient, review laboratory history and record results with clear provenance." },
  organization_admin: { label: "Clinic operations", description: "Coordinate the day, support your team and keep clinic operations in view." },
  platform_owner: { label: "Clinic operations", description: "Coordinate this clinic’s day. Global organization controls remain in Platform Administration." },
};

export function workflowActions(role: UserRole) {
  const patients = { title: "Open patient folders", text: "Find a patient and their longitudinal records.", href: "/dashboard/patients" };
  const queue = { title: "Review today’s queue", text: "Coordinate arrivals and the clinic visit workflow.", href: "/dashboard/appointments" };

  if (role === "lab_scientist") return [
    { title: "Laboratory records", text: "Review results and open a patient folder to record new findings.", href: "/dashboard/laboratory" },
    patients,
  ];
  if (role === "nurse") return [
    { title: "Record patient vitals", text: "Choose a patient and use their visit context when appropriate.", href: "/dashboard/patients" },
    queue,
    patients,
  ];
  if (role === "receptionist") return [
    ...(can(role, "patients:create") ? [{ title: "Register a patient", text: "Start a clear, clinic-owned patient record.", href: "/dashboard/patients/new" }] : []),
    queue,
    patients,
  ];
  if (can(role, "team:manage")) return [
    queue,
    { title: "Clinic team", text: "Review staff access and controlled invitations.", href: "/dashboard/team" },
    { title: "Operational reports", text: "Review real activity within a defined date window.", href: "/dashboard/reports" },
  ];
  return [
    { title: "Consultation records", text: "Continue a patient’s documented care journey.", href: "/dashboard/consultations" },
    { title: "Follow-up review", text: "Review upcoming plans and overdue recall work.", href: "/dashboard/follow-ups" },
    patients,
  ];
}
