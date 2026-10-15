import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  hint?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  hint,
}: StatCardProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <div className="ml-3 rounded-xl border border-sky-100 bg-sky-50/70 p-2.5 text-sky-800" aria-hidden="true">
          {icon}
        </div>
      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}
