"use client";

import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function PatientSearch({ value, onChange }: Props) {
  return (
    <div className="relative w-full md:w-80">
      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search patient..."
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-sky-500"
      />
    </div>
  );
}
