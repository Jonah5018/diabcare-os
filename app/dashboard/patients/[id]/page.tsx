import { notFound } from "next/navigation";
import { Suspense } from "react";
import PrescriptionModule from "@/components/prescriptions/prescription-module";
import VisitSummary from "@/components/visits/visit-summary";
import TimelineModule from "@/components/timeline/timeline-module";
import FollowUpModule from "@/components/follow-ups/follow-up-module";
import DocumentModule from "@/components/documents/document-module";
import { getPatientVisit } from "@/lib/visits/context";

import { getClinicContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { z } from "zod";
import Pagination from "@/components/shared/pagination";
import { PAGE_SIZE, scalar, cursorFilter, encodeCursor, type SearchParams } from "@/lib/pagination";
import PageHeader from "@/components/dashboard/page-header";
import ConsultationForm from "@/components/consultations/consultation-form";
import ConsultationList from "@/components/consultations/consultation-list";
import VitalsCard from "@/components/vitals/vitals-card";
import VitalsForm from "@/components/vitals/vitals-form";
import DiabetesSummary from "@/components/analytics/diabetes-summary";
import LabForm from "@/components/laboratory/lab-form";
import LabResults from "@/components/laboratory/lab-results";
import AppointmentHistory from "@/components/appointments/appointment-history";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}

export default async function PatientProfile({ params, searchParams }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const filters = await searchParams;
  const { supabase, profile } = await getClinicContext();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!patient) notFound();

  const visit = await getPatientVisit(patient.id, scalar(filters.appointment));
  const clinicalRecordingAllowed = !visit
    || ["waiting", "in_consultation", "completed"].includes(visit.status);

  const base = (table: "appointments" | "consultations" | "vitals" | "laboratory_results") => supabase.from(table).select("*")
    .eq("patient_id", id).eq("organization_id", profile.organization_id);
  const history = (table: "appointments" | "consultations" | "laboratory_results", parameter: string, column: "created_at" | "visit_date" | "appointment_date") => {
    let query = base(table).order(column, { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
    const filter = cursorFilter(scalar(filters[parameter]), column);
    if (filter) query = query.or(filter);
    return query;
  };
  const [appointmentResult, consultationResult, vitalResult, labResult] = await Promise.all([
    history("appointments", "appointmentCursor", "appointment_date"),
    history("consultations", "consultationCursor", "visit_date"),
    base("vitals").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    history("laboratory_results", "labCursor", "created_at"),
  ]);
  if (consultationResult.error || vitalResult.error || labResult.error) throw new Error("Unable to load this patient's clinical records");
  const appointmentsError = appointmentResult.error;
  const appointments = (appointmentResult.data ?? []).slice(0, PAGE_SIZE);
  const consultations = (consultationResult.data ?? []).slice(0, PAGE_SIZE);
  const labResults = (labResult.data ?? []).slice(0, PAGE_SIZE);
  const latestVitals = vitalResult.data;
  const cursorParameters = [
    "appointment",
    "appointmentCursor",
    "consultationCursor",
    "labCursor",
    "prescriptionCursor",
    "timelineCursor",
    "followUpCursor",
    "documentCursor",
  ];
  const pageQuery = Object.fromEntries(
    cursorParameters.map(key => [key, scalar(filters[key])])
  );
  const paging = (rows: { id: string; created_at: string | null; visit_date?: string | null; appointment_date?: string }[], length: number, parameter: string, column: "created_at" | "visit_date" | "appointment_date") => {
    const last = rows[rows.length - 1];
    return <Pagination path={`/dashboard/patients/${id}`} query={pageQuery} parameter={parameter} hasMore={length > PAGE_SIZE} cursor={last ? encodeCursor({ id: last.id, created_at: last[column] ?? null }) : undefined} />;
  };

  const age = calculateAge(patient.date_of_birth);

  const formattedDob = patient.date_of_birth ? new Date(
    patient.date_of_birth
  ).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) : "Not recorded";

  const gender =
    patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "Not recorded";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${patient.last_name} ${patient.first_name}`}
        subtitle="Digital Patient Folder"
      />

      {visit ? (
        <Suspense fallback={<p role="status">Loading visit summary...</p>}>
          <VisitSummary patientId={patient.id} visit={visit} />
        </Suspense>
      ) : null}

      {/* Hero Card */}
      <DiabetesSummary
        bmi={latestVitals?.bmi}
        fbs={latestVitals?.fasting_blood_sugar}
        rbs={latestVitals?.random_blood_sugar}
      />
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-100 text-3xl font-bold text-sky-700">
            {patient.first_name[0]}
            {patient.last_name[0]}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {patient.last_name} {patient.first_name}
              </h2>

              <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">
                {patient.hospital_number}
              </span>
            </div>

            {patient.other_names && (
              <p className="mt-1 text-slate-500">
                {patient.other_names}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>{gender}</span>
              <span>{age === null ? "Age not recorded" : `${age} years`}</span>
              <span>{patient.phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Information */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Personal Information
          </h3>

          <div className="space-y-3">
            <Info label="Date of Birth" value={formattedDob} />
            <Info label="Address" value={patient.address || "Not provided"} />
            <Info label="Gender" value={gender} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Emergency Contact
          </h3>

          <div className="space-y-3">
            <Info
              label="Next of Kin"
              value={patient.next_of_kin_name || "Not provided"}
            />
            <Info
              label="Phone"
              value={patient.next_of_kin_phone || "Not provided"}
            />
          </div>
        </div>
      </div>

      {/* Vitals Module */}
      <Suspense fallback={<p role="status">Loading patient timeline...</p>}>
        <TimelineModule
          patientId={patient.id}
          cursor={scalar(filters.timelineCursor)}
          query={pageQuery}
        />
      </Suspense>

      <div id="vitals" className="scroll-mt-20 space-y-6">
        <VitalsCard vitals={latestVitals} />

        {clinicalRecordingAllowed && can(profile.role, "vitals:create") ? (
          <VitalsForm patientId={patient.id} appointmentId={visit?.id} />
        ) : null}
      </div>

      {/* Laboratory Module */}
      <div id="laboratory" className="scroll-mt-20 space-y-6">
        {clinicalRecordingAllowed && can(profile.role, "laboratory:create") ? (
          <LabForm patientId={patient.id} appointmentId={visit?.id} />
        ) : null}

        <div className="rounded-2xl border bg-slate-50 p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Laboratory History
          </h3>

          <LabResults results={labResults} />
          {paging(labResults, labResult.data?.length ?? 0, "labCursor", "created_at")}
        </div>
      </div>
      {/* Consultation Module */}
      <div id="consultations" className="scroll-mt-20 space-y-6">
        {clinicalRecordingAllowed && can(profile.role, "consultations:create") ? (
          <ConsultationForm patientId={patient.id} appointmentId={visit?.id} />
        ) : null}

        <div className="rounded-2xl border bg-slate-50 p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Consultation History
          </h3>

          <ConsultationList
            consultations={consultations}
            canPrescribe={can(profile.role, "prescriptions:create")}
            canPlanFollowUp={can(profile.role, "follow-ups:create")}
          />
          {paging(consultations, consultationResult.data?.length ?? 0, "consultationCursor", "visit_date")}
        </div>
      </div>

      <Suspense fallback={<p role="status">Loading prescription history...</p>}>
        <PrescriptionModule
          patientId={patient.id}
          cursor={scalar(filters.prescriptionCursor)}
          query={pageQuery}
        />
      </Suspense>

      <Suspense fallback={<p role="status">Loading follow-up plans...</p>}>
        <FollowUpModule patientId={patient.id} cursor={scalar(filters.followUpCursor)} query={pageQuery} />
      </Suspense>

      <Suspense fallback={<p role="status">Loading patient documents...</p>}>
        <DocumentModule patientId={patient.id} cursor={scalar(filters.documentCursor)} query={pageQuery} />
      </Suspense>

      {appointmentsError ? (
        <section className="rounded-2xl border bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Appointment History</h3>
          <p role="alert" className="text-sm text-rose-700">
            Unable to load appointment history. Please refresh to try again.
          </p>
        </section>
      ) : (
        <div id="appointments" className="scroll-mt-20 space-y-4">
          <AppointmentHistory appointments={appointments} patientId={patient.id} />
          {paging(appointments, appointmentResult.data?.length ?? 0, "appointmentCursor", "appointment_date")}
        </div>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);

  let age = today.getFullYear() - birth.getFullYear();

  const hasBirthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate());

  if (!hasBirthdayPassed) age--;

  return age;
}
