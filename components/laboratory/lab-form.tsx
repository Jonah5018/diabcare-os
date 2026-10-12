"use client";

import ActionForm from "@/components/shared/action-form";

import { FlaskConical } from "lucide-react";
import { createLabResult } from "@/actions/laboratory";

export default function LabForm({
  patientId,
}: {
  patientId: string;
}) {
  return (
    <ActionForm
      action={createLabResult}
      className="space-y-6 rounded-2xl border bg-white p-6"
    >
      <input type="hidden" name="patient_id" value={patientId} />

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-100 p-2 text-violet-600">
          <FlaskConical className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-lg font-semibold">
            Laboratory Results
          </h3>
          <p className="text-sm text-slate-500">
            Completed by the laboratory scientist
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input name="hba1c" label="HbA1c" unit="%" step="0.1" />

        <Input
          name="creatinine"
          label="Creatinine"
          unit="µmol/L"
          step="0.1"
        />

        <Input
          name="total_cholesterol"
          label="Total Cholesterol"
          unit="mmol/L"
          step="0.1"
        />

        <Input name="hdl" label="HDL" unit="mmol/L" step="0.1" />

        <Input name="ldl" label="LDL" unit="mmol/L" step="0.1" />

        <Input
          name="triglycerides"
          label="Triglycerides"
          unit="mmol/L"
          step="0.1"
        />

        <Select
          name="urine_protein"
          label="Urine Protein"
        />

        <Select
          name="urine_glucose"
          label="Urine Glucose"
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">Laboratory Notes</label>

        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-xl border p-3 outline-none focus:border-violet-500"
        />
      </div>

      <button className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white transition hover:bg-violet-700">
        Save Laboratory Result
      </button>
    </ActionForm>
  );
}

function Input({
  name,
  label,
  unit,
  step,
}: {
  name: string;
  label: string;
  unit: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>

      <div className="flex rounded-xl border">
        <input
          id={name}
          name={name}
          type="number"
          step={step}
          required
          className="min-w-0 flex-1 rounded-l-xl p-3 outline-none"
        />

        <span className="flex items-center border-l bg-slate-50 px-3 text-sm text-slate-500">
          {unit}
        </span>
      </div>
    </div>
  );
}

function Select({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>

      <select
        id={name}
        name={name}
        className="w-full rounded-xl border p-3 outline-none focus:border-violet-500"
      >
        <option>Negative</option>
        <option>Trace</option>
        <option>1+</option>
        <option>2+</option>
        <option>3+</option>
      </select>
    </div>
  );
}
