import Link from "next/link";
import PatientRow from "./patient-row";

type Patient = { id: string; hospital_number: string; first_name: string; last_name: string; other_names: string | null; gender: string; phone: string };

export default function PatientTable({ patients, search = "" }: { patients: Patient[]; search?: string }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h2 className="text-lg font-semibold text-slate-900">Registered Patients</h2><p className="text-sm text-slate-500">{patients.length} patient(s) on this page</p></div>
        <form action="/dashboard/patients" className="flex w-full gap-2 md:w-auto">
          <label htmlFor="patient-search" className="sr-only">Search patients</label>
          <input id="patient-search" name="q" defaultValue={search} maxLength={80} placeholder="Name, hospital number, or phone" className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-sm md:w-72" />
          <button className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">Search</button>
        </form>
      </div>
      {patients.length === 0 ? <p role="status" className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-500">No patients match your search.</p> : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block">
            <table className="w-full"><thead className="bg-slate-50"><tr>{["Hospital No.", "Patient", "Gender", "Phone"].map(label => <th key={label} className="p-4 text-left text-sm font-semibold">{label}</th>)}</tr></thead><tbody>{patients.map(patient => <PatientRow key={patient.id} patient={patient} />)}</tbody></table>
          </div>
          <div className="space-y-3 md:hidden">{patients.map(patient => (
            <article key={patient.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/dashboard/patients/${patient.id}`} className="font-bold text-sky-700">{patient.hospital_number}</Link><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{patient.gender}</span></div>
              <h3 className="mt-3 font-semibold"><Link href={`/dashboard/patients/${patient.id}`}>{patient.last_name}{" "}{patient.first_name}</Link></h3>
              {patient.other_names ? <p className="text-sm text-slate-500">{patient.other_names}</p> : null}
              <p className="mt-2 text-sm">{patient.phone}</p>
            </article>
          ))}</div>
        </>
      )}
    </div>
  );
}
