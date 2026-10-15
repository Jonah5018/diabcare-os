const sections = [
  ["timeline", "Timeline"],
  ["vitals", "Vitals"],
  ["laboratory", "Laboratory"],
  ["consultations", "Consultations"],
  ["prescriptions", "Prescriptions"],
  ["follow-ups", "Follow-ups"],
  ["documents", "Documents"],
  ["appointments", "Visits"],
] as const;

export default function PatientFolderNav() {
  return (
    <nav aria-label="Patient folder sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      {sections.map(([id, label]) => (
        <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-medium text-slate-600 hover:bg-sky-50 hover:text-sky-900">
          {label}
        </a>
      ))}
    </nav>
  );
}
