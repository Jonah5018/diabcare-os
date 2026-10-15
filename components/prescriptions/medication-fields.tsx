"use client";

const fields = [
  { name: "medication_name", label: "Medication name", maximum: 200, required: true },
  { name: "strength", label: "Strength", maximum: 100, required: true },
  { name: "dose", label: "Dose", maximum: 100, required: true },
  { name: "frequency", label: "Frequency", maximum: 100, required: true },
  { name: "route", label: "Route (optional)", maximum: 80, required: false },
  { name: "duration", label: "Duration", maximum: 100, required: true },
  { name: "instructions", label: "Instructions (optional)", maximum: 2000, required: false },
] as const;

export default function MedicationFields({ index, rowId }: { index: number; rowId: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(field => {
        const id = `medication-${rowId}-${field.name}`;
        const className = "w-full rounded-xl border p-3 outline-none focus:border-sky-500";

        return (
          <div key={field.name} className={field.name === "instructions" ? "sm:col-span-2" : ""}>
            <label htmlFor={id} className="mb-1 block text-sm font-medium">
              {field.label}
            </label>
            {field.name === "instructions" ? (
              <textarea
                id={id}
                name={`items.${index}.${field.name}`}
                rows={2}
                maxLength={field.maximum}
                className={className}
              />
            ) : (
              <input
                id={id}
                name={`items.${index}.${field.name}`}
                type="text"
                required={field.required}
                maxLength={field.maximum}
                className={className}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
