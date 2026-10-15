export type NotificationKind =
  | "appointment_reminder"
  | "appointment_cancelled"
  | "follow_up_reminder"
  | "clinic_notice";

export type NotificationStatus = "queued" | "leased" | "submitted" | "delivered" | "failed" | "suppressed";

export interface NotificationEvent {
  id: string;
  organization_id: string;
  patient_id: string | null;
  kind: NotificationKind;
  provider: string;
  status: NotificationStatus;
  available_at: string;
  attempt_count: number;
  created_at: string;
  delivered_at: string | null;
}

export interface NotificationJob extends NotificationEvent {
  lease_token: string;
}

export interface NotificationProvider {
  name: string;
  deliver: (job: NotificationJob) => Promise<"delivered" | "suppressed">;
}

export const notificationTitles: Record<NotificationKind, string> = {
  appointment_reminder: "Appointment reminder for clinic attention",
  appointment_cancelled: "Appointment cancellation recorded",
  follow_up_reminder: "Follow-up reminder for clinic attention",
  clinic_notice: "Clinic administration notice",
};
