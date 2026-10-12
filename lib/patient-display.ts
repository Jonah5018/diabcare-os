export type PatientIdentity = { first_name: string; last_name: string; other_names: string | null; hospital_number: string };
export function patientName(patient: PatientIdentity | null) {
  return patient ? [patient.last_name, patient.first_name, patient.other_names].filter(Boolean).join(" ") : "Patient record unavailable";
}
export function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}
