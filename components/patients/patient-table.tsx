import Link from "next/link";
import PatientRow from "./patient-row";
import EmptyState from "@/components/shared/empty-state";

type Patient = {
  id: string;
  hospital_number: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  gender: string;
  phone: string;
};

export default function PatientTable({ patients, search = "" }: { patients: Patient[]; search?: string }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Patient directory</h2>
          <p className="mt-1 text-xs text-slate-500">{patients.length} records on this page</p>
        </div>
        <form action="/dashboard/patients" className="flex min-w-0 flex-wrap gap-2 xl:w-auto">
          <label htmlFor="patient-search" className="sr-only">Search patients</label>
          <input
            id="patient-search"
            name="q"
            type="search"
            defaultValue={search}
            maxLength={80}
            placeholder="Name, hospital number, or phone"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base xl:w-72"
          />
          <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Search</button>
        </form>
      </div>

      {patients.length === 0 ? (
        <EmptyState
          title={search ? "No matching patients" : "Your patient directory starts here"}
          description={search ? "No patients match your search. Try a different name, hospital number or phone." : "Registered patients will appear here. Use New Patient if your clinic role permits registration."}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {["Hospital No.", "Patient", "Gender", "Phone"].map(label => (
                    <th key={label} scope="col" className="p-4 text-left text-xs font-semibold text-slate-500">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{patients.map(patient => <PatientRow key={patient.id} patient={patient} />)}</tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {patients.map(patient => (
              <article key={patient.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/dashboard/patients/${patient.id}`} className="inline-flex min-h-11 items-center text-xs font-semibold text-sky-800">
                    {patient.hospital_number}
                  </Link>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] capitalize text-slate-600">{patient.gender || "Not recorded"}</span>
                </div>
                <h3 className="font-semibold text-slate-900">
                  <Link href={`/dashboard/patients/${patient.id}`} className="inline-flex min-h-11 items-center">
                    {patient.last_name}{" "}{patient.first_name}
                  </Link>
                </h3>
                {patient.other_names ? <p className="text-sm text-slate-500">{patient.other_names}</p> : null}
                <p className="mt-2 break-words text-sm text-slate-500">{patient.phone || "Phone not recorded"}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
