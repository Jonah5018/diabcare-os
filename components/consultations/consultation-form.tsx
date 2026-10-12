"use client";

import ActionForm from "@/components/shared/action-form";

import { createConsultation } from "@/actions/consultation";

export default function ConsultationForm({
  patientId,
}: {
  patientId: string;
}) {
  return (
    <ActionForm
      action={createConsultation}
      className="space-y-4 rounded-2xl border bg-white p-6"
    >
      <input type="hidden" name="patient_id" value={patientId} />

      <h3 className="text-lg font-semibold">
        New Consultation
      </h3>

      <div>
        <label htmlFor="chief_complaint" className="mb-1 block text-sm font-medium">Chief Complaint</label>
        <textarea
          id="chief_complaint"
          name="chief_complaint"
          rows={2}
          required
          className="w-full rounded-xl border p-3 outline-none focus:border-sky-500"
          placeholder="Why is the patient here today?"
        />
      </div>

      <div>
        <label htmlFor="diagnosis" className="mb-1 block text-sm font-medium">Diagnosis</label>
        <textarea
          id="diagnosis"
          name="diagnosis"
          rows={2}
          required
          className="w-full rounded-xl border p-3 outline-none focus:border-sky-500"
          placeholder="Type 2 Diabetes Mellitus..."
        />
      </div>

      <div>
        <label htmlFor="treatment_plan" className="mb-1 block text-sm font-medium">Treatment Plan</label>
        <textarea
          id="treatment_plan"
          name="treatment_plan"
          rows={3}
          className="w-full rounded-xl border p-3 outline-none focus:border-sky-500"
          placeholder="Metformin 500mg BD..."
        />
      </div>

      <div>
        <label htmlFor="consultation-notes" className="mb-1 block text-sm font-medium">Clinical Notes</label>
        <textarea
          id="consultation-notes"
          name="notes"
          rows={3}
          className="w-full rounded-xl border p-3 outline-none focus:border-sky-500"
          placeholder="Additional observations..."
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-sky-600 py-3 font-semibold text-white hover:bg-sky-700"
      >
        Save Consultation
      </button>
    </ActionForm>
  );
}
