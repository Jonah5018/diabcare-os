import { z } from "zod";

const count = z.number().int().nonnegative();
export const operationalReportSchema = z.object({
  registrations: count,
  bookings: count,
  non_cancelled: count,
  completed: count,
  cancelled: count,
  check_ins: count,
  consultations: count,
  vitals: count,
  laboratory: count,
  prescriptions: count,
  follow_ups_due: count,
  follow_ups_planned: count,
  follow_ups_overdue: count,
  cohort_patients: count,
  cohort_with_vitals: count,
  cohort_with_labs: count,
});
export type OperationalReport = z.infer<typeof operationalReportSchema>;

export const metricLabels: Record<keyof OperationalReport, string> = {
  registrations: "New patient registrations",
  bookings: "All scheduled bookings",
  non_cancelled: "Non-cancelled bookings",
  completed: "Completed appointments",
  cancelled: "Cancelled appointments",
  check_ins: "Recorded check-ins",
  consultations: "Consultation records",
  vitals: "Vitals records",
  laboratory: "Laboratory records",
  prescriptions: "Prescriptions dated in period",
  follow_ups_due: "Follow-ups due in period",
  follow_ups_planned: "Due plans still planned",
  follow_ups_overdue: "Due plans overdue today",
  cohort_patients: "Patients with non-cancelled bookings",
  cohort_with_vitals: "Booked patients with vitals recorded",
  cohort_with_labs: "Booked patients with labs recorded",
};
