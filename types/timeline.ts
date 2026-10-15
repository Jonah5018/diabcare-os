export const TIMELINE_KINDS = [
  "appointment_booked",
  "appointment_checked_in",
  "appointment_started",
  "appointment_completed",
  "appointment_cancelled",
  "vitals_recorded",
  "consultation_recorded",
  "laboratory_recorded",
  "prescription_created",
  "prescription_completed",
  "prescription_cancelled",
  "follow_up_planned",
  "follow_up_completed",
  "follow_up_cancelled",
] as const;

export type TimelineKind = typeof TIMELINE_KINDS[number];

export interface TimelineCursor {
  time: string | null;
  kind: TimelineKind;
  id: string;
}

export interface TimelineEvent {
  event_kind: TimelineKind;
  source_id: string;
  occurred_at: string | null;
  appointment_id: string | null;
  details: Record<string, string | number | null>;
}

export const TIMELINE_LABELS: Record<TimelineKind, string> = {
  appointment_booked: "Appointment booked",
  appointment_checked_in: "Patient checked in",
  appointment_started: "Consultation started",
  appointment_completed: "Appointment completed",
  appointment_cancelled: "Appointment cancelled",
  vitals_recorded: "Vitals recorded",
  consultation_recorded: "Consultation recorded",
  laboratory_recorded: "Laboratory results recorded",
  prescription_created: "Prescription created",
  prescription_completed: "Prescription completed",
  prescription_cancelled: "Prescription cancelled",
  follow_up_planned: "Follow-up planned",
  follow_up_completed: "Follow-up completed",
  follow_up_cancelled: "Follow-up cancelled",
};
