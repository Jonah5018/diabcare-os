export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_consultation"
  | "completed"
  | "cancelled";

export type AppointmentFormState = {
  error?: string;
  success?: string;
};
