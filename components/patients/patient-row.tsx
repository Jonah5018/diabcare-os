import Link from "next/link";

interface Patient {
  id: string;
  hospital_number: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  gender: string;
  phone: string;
}

export default function PatientRow({ patient }: { patient: Patient }) {
  const fullName =
    `${patient.last_name} ${patient.first_name} ${patient.other_names ?? ""}`.trim();

  return (
    <tr className="border-t transition hover:bg-slate-50">
      <td className="p-4 font-semibold text-sky-700">
        <Link href={`/dashboard/patients/${patient.id}`}>
          {patient.hospital_number}
        </Link>
      </td>

      <td className="p-4">
        <Link href={`/dashboard/patients/${patient.id}`}>
          <div>
            <p className="font-medium text-slate-900">{fullName}</p>
            <p className="text-xs capitalize text-slate-500">
              {patient.gender}
            </p>
          </div>
        </Link>
      </td>

      <td className="hidden p-4 capitalize md:table-cell">
        {patient.gender}
      </td>

      <td className="p-4">{patient.phone}</td>
    </tr>
  );
}
