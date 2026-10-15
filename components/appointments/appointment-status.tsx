import type { AppointmentStatus } from "@/types/appointment";

const labels: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  waiting: "Waiting",
  in_consultation: "In Consultation",
  completed: "Completed",
  cancelled: "Cancelled",
};

const colors: Record<AppointmentStatus, string> = {
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  waiting: "border-amber-200 bg-amber-50 text-amber-800",
  in_consultation: "border-cyan-200 bg-cyan-50 text-cyan-900",
  completed: "border-teal-200 bg-teal-50 text-teal-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${colors[status]}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
