"use client";

import ActionForm from "@/components/shared/action-form";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { createVitals } from "@/actions/vitals";

export default function VitalsForm({
  patientId,
}: {
  patientId: string;
}) {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const bmi = useMemo(() => {
    const w = Number(weight);
    const h = Number(height) / 100;

    if (!w || !h) return "--";

    return (w / (h * h)).toFixed(1);
  }, [weight, height]);

  return (
    <ActionForm
      action={createVitals}
      className="space-y-6 rounded-2xl border bg-white p-6"
    >
      <input type="hidden" name="patient_id" value={patientId} />

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-red-100 p-2 text-red-600">
          <Activity className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-lg font-semibold">
            Record Patient Vitals
          </h3>
          <p className="text-sm text-slate-500">
            Usually completed by the nurse
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input name="systolic_bp" label="Systolic BP" unit="mmHg" />
        <Input
          name="diastolic_bp"
          label="Diastolic BP"
          unit="mmHg"
        />

        <Input name="pulse" label="Pulse Rate" unit="bpm" />

        <Input name="spo2" label="SpO₂" unit="%" />

        <Input
          name="temperature"
          label="Temperature"
          unit="°C"
          step="0.1"
        />

        <div>
          <label htmlFor="weight" className="mb-1 block text-sm font-medium">Weight (kg)</label>
          <input
            id="weight"
            name="weight"
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-xl border p-3 outline-none focus:border-sky-500"
            required
          />
        </div>

        <div>
          <label htmlFor="height" className="mb-1 block text-sm font-medium">Height (cm)</label>
          <input
            id="height"
            name="height"
            type="number"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="w-full rounded-xl border p-3 outline-none focus:border-sky-500"
            required
          />
        </div>

        <Input
          name="fasting_blood_sugar"
          label="FBS"
          unit="mmol/L"
          step="0.1"
        />

        <Input
          name="random_blood_sugar"
          label="RBS"
          unit="mmol/L"
          step="0.1"
        />
      </div>

      <div className="rounded-xl bg-sky-50 p-4">
        <p className="text-xs text-slate-500">
          Body Mass Index
        </p>
        <p className="text-3xl font-bold text-sky-700">
          {bmi}
        </p>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition duration-200 hover:scale-[1.01] hover:bg-red-700 active:scale-[0.99]"
      >
        Save Vitals
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
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>

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
