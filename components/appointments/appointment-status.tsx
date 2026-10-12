import type { AppointmentStatus } from "@/types/appointment";

const labels: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  waiting: "Waiting",
  in_consultation: "In Consultation",
  completed: "Completed",
  cancelled: "Cancelled",
};

const colors: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  waiting: "bg-amber-50 text-amber-700",
  in_consultation: "bg-violet-50 text-violet-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
};

export default function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
