"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createPrescription } from "@/actions/prescription";
import MedicationFields from "@/components/prescriptions/medication-fields";
import type { PrescriptionFormResult } from "@/types/prescription";

const medicationFields = [
  "medication_name", "strength", "dose", "frequency", "route", "duration", "instructions",
];

export default function PrescriptionForm({ patientId, consultationId, today }: {
  patientId: string;
  consultationId: string;
  today: string;
}) {
  const [state, dispatch, pending] = useActionState<PrescriptionFormResult, FormData>(
    createPrescription, {}
  );
  const [rows, setRows] = useState([0]);
  const nextRow = useRef(1);
  const requestId = useRef<string | null>(null);

  if (state.success) {
    return (
      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <p role="status" className="text-emerald-700">{state.success}</p>
        <Link href={`/dashboard/patients/${patientId}#prescriptions`} className="text-sky-700 underline">
          View prescription history
        </Link>
      </section>
    );
  }

  return (
    <form
      className="space-y-6 rounded-2xl border bg-white p-6"
      aria-busy={pending}
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;

        const data = new FormData(event.currentTarget);
        const items = rows.map((_, index) => Object.fromEntries(
          medicationFields.map(field => [field, data.get(`items.${index}.${field}`) ?? ""])
        ));

        requestId.current ??= crypto.randomUUID();
        data.set("patient_id", patientId);
        data.set("consultation_id", consultationId);
        data.set("request_id", requestId.current);
        data.set("items", JSON.stringify(items));

        startTransition(() => dispatch(data));
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        <div>
          <label htmlFor="prescribed-date" className="mb-1 block text-sm font-medium">
            Prescribed date
          </label>
          <input id="prescribed-date" name="prescribed_date" type="date"
            defaultValue={today} min="1900-01-01" max={today} required
            className="w-full rounded-xl border p-3 sm:w-auto" />
        </div>

        {rows.map((rowId, index) => (
          <fieldset key={rowId} className="min-w-0 space-y-4 rounded-xl border p-4">
            <legend className="px-2 font-semibold">Medication {index + 1}</legend>
            <MedicationFields index={index} rowId={rowId} />
            {rows.length > 1 ? (
              <button type="button" onClick={() => setRows(current => current.filter(id => id !== rowId))}
                className="rounded-lg border px-4 py-2 text-sm text-rose-700">
                Remove medication {index + 1}
              </button>
            ) : null}
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={rows.length >= 20}
            onClick={() => {
              const rowId = nextRow.current++;
              setRows(current => [...current, rowId]);
            }}
            className="rounded-xl border px-5 py-3 font-medium disabled:opacity-50">
            Add medication
          </button>
          <button type="submit" className="rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white">
            Save prescription
          </button>
        </div>
      </fieldset>
      {pending ? <p role="status" className="text-sm text-slate-500">Saving prescription...</p> : null}
      {state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}</p> : null}
    </form>
  );
}
