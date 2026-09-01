import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PatientsPage() {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="text-slate-500">
            Manage registered patients
          </p>
        </div>

        <Link
          href="/dashboard/patients/new"
          className="rounded-lg bg-sky-600 px-5 py-3 text-white"
        >
          + New Patient
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left">Hospital No.</th>
              <th className="text-left">Patient</th>
              <th className="text-left">Gender</th>
              <th className="text-left">Phone</th>
            </tr>
          </thead>

          <tbody>
            {patients?.length ? (
              patients.map((patient) => (
                <tr key={patient.id} className="border-t">
                  <td className="p-4 font-semibold">
                    {patient.hospital_number}
                  </td>
                  <td>
                    {patient.last_name} {patient.first_name}{" "}
                    {patient.other_names}
                  </td>
                  <td>{patient.gender}</td>
                  <td>{patient.phone}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  No patients registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}