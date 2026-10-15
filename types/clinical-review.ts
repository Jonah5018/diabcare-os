import type { z } from "zod";
import type {
  reviewAppointmentSchema,
  reviewConsultationSchema,
  reviewFollowUpSchema,
  reviewLabSchema,
  reviewPatientSchema,
  reviewPrescriptionSchema,
  reviewVitalSchema,
} from "@/lib/validations/clinical-review";

export type ReviewSlice<T> = { rows: T[]; hasMore: boolean };
export type ReviewVital = z.infer<typeof reviewVitalSchema>;
export type ReviewLab = z.infer<typeof reviewLabSchema>;
export type ReviewConsultation = z.infer<typeof reviewConsultationSchema>;
export type ReviewPrescription = z.infer<typeof reviewPrescriptionSchema>;
export type ReviewFollowUp = z.infer<typeof reviewFollowUpSchema>;

export type ClinicalReviewData = {
  patient: z.infer<typeof reviewPatientSchema>;
  today: string;
  vitals: ReviewSlice<ReviewVital>;
  laboratories: ReviewSlice<ReviewLab>;
  consultations: ReviewSlice<ReviewConsultation>;
  appointments: ReviewSlice<z.infer<typeof reviewAppointmentSchema>>;
  prescriptions: ReviewSlice<ReviewPrescription>;
  followUps: ReviewSlice<ReviewFollowUp>;
};

export type MeasurementPoint = {
  sourceId: string;
  recordedAt: string | null;
  value: number | null;
};

export type MeasurementTrend = {
  points: (MeasurementPoint & { recordedAt: string; value: number })[];
  change: number | null;
  coordinates: string | null;
  omitted: number;
};
