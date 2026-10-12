import AccessDenied from "@/components/shared/access-denied";
import { can } from "@/lib/auth/permissions";
import PatientRegistration from "@/components/patients/patient-registration";
import { getClinicContext } from "@/lib/auth/context";

export default async function NewPatientPage() {
  const { profile } = await getClinicContext();
  if (!can(profile.role, "patients:create")) return <AccessDenied />;
  return <PatientRegistration />;
}
