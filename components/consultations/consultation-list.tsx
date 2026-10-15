import Link from "next/link";

interface Consultation {
  id: string;
  visit_date: string;
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  notes: string;
}

export default function ConsultationList({
  consultations,
  canPrescribe = false,
  canPlanFollowUp = false,
}: {
  consultations: Consultation[];
  canPrescribe?: boolean;
  canPlanFollowUp?: boolean;
}) {
  if (consultations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
        No consultations yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consultations.map((item) => (
        <div key={item.id} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold text-slate-900">
              {new Date(item.visit_date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </h4>

            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
              Consultation
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <p>
              <strong>Chief Complaint:</strong>{" "}
              {item.chief_complaint}
            </p>

            <p>
              <strong>Diagnosis:</strong> {item.diagnosis}
            </p>

            <p>
              <strong>Treatment:</strong>{" "}
              {item.treatment_plan || "—"}
            </p>

            <p>
              <strong>Notes:</strong> {item.notes || "—"}
            </p>
          </div>
          {canPlanFollowUp ? (
            <Link href={`/dashboard/consultations/${item.id}/follow-ups/new`}
              className="mr-3 mt-4 inline-block rounded-lg border px-4 py-2 text-sm font-medium text-sky-700">
              Plan follow-up
            </Link>
          ) : null}
          {canPrescribe ? (
            <Link
              href={`/dashboard/consultations/${item.id}/prescriptions/new`}
              className="mt-4 inline-block rounded-lg border px-4 py-2 text-sm font-medium text-sky-700"
            >
              Create prescription
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
