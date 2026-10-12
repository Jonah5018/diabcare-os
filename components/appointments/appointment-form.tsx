"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";

import { createAppointment, searchAppointmentPatients, searchAppointmentDoctors } from "@/actions/appointment";
import type { AppointmentFormState } from "@/types/appointment";

type PatientOption = {
  id: string;
  hospital_number: string;
  first_name: string;
  other_names: string | null;
  last_name: string;
};

type DoctorOption = {
  id: string;
  full_name: string;
};

type AppointmentFormProps = {
  patients: PatientOption[];
  doctors: DoctorOption[];
  clinicToday: string;
};

const initialState: AppointmentFormState = {};

export default function AppointmentForm({
  patients,
  doctors,
  clinicToday,
}: AppointmentFormProps) {
  const [state, formAction, pending] = useActionState(
    createAppointment,
    initialState
  );

  const [doctorOptions, setDoctorOptions] = useState(doctors);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorError, setDoctorError] = useState("");
  const [findingDoctors, startDoctorSearch] = useTransition();
  const [patientOptions, setPatientOptions] = useState(patients);
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, startSearch] = useTransition();

  function findDoctors() {
    startDoctorSearch(async () => {
      try {
        const result = await searchAppointmentDoctors(doctorSearch);
        setDoctorOptions(result.doctors);
        setDoctorError(result.error ?? "");
      } catch { setDoctorError("Unable to search doctors. Please try again."); }
    });
  }

  function findPatients() {
    startSearch(async () => {
      try {
        const result = await searchAppointmentPatients(search);
        setPatientOptions(result.patients);
        setSearchError(result.error ?? "");
      } catch { setSearchError("Unable to search patients. Please try again."); }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700">
          <CalendarPlus className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Book Appointment
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Schedule a patient visit. Queue numbers are assigned when the patient
            checks in.
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-5">
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          <div>
            <label htmlFor="booking-search" className="mb-2 block text-sm font-medium text-slate-700">Find a patient</label>
            <div className="mb-3 flex gap-2">
              <input id="booking-search" value={search} onChange={event => setSearch(event.target.value)} maxLength={80} placeholder="Name or hospital number" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" />
              <button type="button" onClick={findPatients} disabled={searching} className="rounded-xl border px-3 py-2 text-sm font-medium">{searching ? "Searching..." : "Find"}</button>
            </div>
            {searchError ? <p role="alert" className="mb-2 text-sm text-rose-700">{searchError}</p> : null}
            <p className="mb-2 text-xs text-slate-500">Showing up to 20 matching patients.</p>
            <label htmlFor="patient_id" className="mb-2 block text-sm font-medium text-slate-700">
              Patient
            </label>
            <select
              id="patient_id"
              disabled={searching}
              name="patient_id"
              required
              defaultValue=""
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              <option value="" disabled>Select patient</option>
              {patientOptions.map((patient) => {
                const otherNames = patient.other_names ? ` ${patient.other_names}` : "";

                return (
                  <option key={patient.id} value={patient.id}>
                    {patient.hospital_number}{" · "}{patient.last_name}{" "}
                    {patient.first_name}{otherNames}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="appointment_date" className="mb-2 block text-sm font-medium text-slate-700">
                Appointment Date
              </label>
              <input
                id="appointment_date"
                name="appointment_date"
                type="date"
                min={clinicToday}
                defaultValue={clinicToday}
                required
                className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label htmlFor="appointment_time" className="mb-2 block text-sm font-medium text-slate-700">
                Appointment Time
              </label>
              <input
                id="appointment_time"
                name="appointment_time"
                type="time"
                className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="doctor-search" className="mb-2 block text-sm font-medium text-slate-700">Find a doctor</label>
            <div className="mb-3 flex gap-2"><input id="doctor-search" value={doctorSearch} onChange={event => setDoctorSearch(event.target.value)} maxLength={80} placeholder="Doctor name" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" /><button type="button" onClick={findDoctors} disabled={findingDoctors} className="rounded-xl border px-3 py-2 text-sm font-medium">{findingDoctors ? "Searching..." : "Find doctor"}</button></div>
            {doctorError ? <p role="alert" className="mb-2 text-sm text-rose-700">{doctorError}</p> : null}
            <label htmlFor="doctor_id" className="mb-2 block text-sm font-medium text-slate-700">
              Doctor
            </label>
            <select
              id="doctor_id"
              disabled={findingDoctors}
              name="doctor_id"
              defaultValue=""
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              <option value="">Assign later</option>
              {doctorOptions.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reason" className="mb-2 block text-sm font-medium text-slate-700">
              Reason for Visit
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              maxLength={500}
              placeholder="Routine diabetes follow-up, medication review, new symptoms..."
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <button
            type="submit"
            disabled={pending || searching || findingDoctors || patientOptions.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <CalendarPlus className="h-4 w-4" />
            {pending ? "Booking..." : "Book Appointment"}
          </button>
        </fieldset>

        {state.error ? (
          <p role="alert" className="text-sm text-rose-700">{state.error}</p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-emerald-700">{state.success}</p>
        ) : null}
        {patientOptions.length === 0 ? (
          <p className="text-center text-sm text-amber-700">
            No matching patients. Try another search, or register a new patient.
          </p>
        ) : null}
      </form>
    </section>
  );
}
