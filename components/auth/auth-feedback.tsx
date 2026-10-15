import { CircleAlert, CircleCheck } from "lucide-react";

export default function AuthFeedback({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${error ? "border-red-200 bg-red-50 text-red-800" : "border-teal-200 bg-teal-50 text-teal-900"}`}
    >
      {error
        ? <CircleAlert size={18} className="mt-1 shrink-0" aria-hidden="true" />
        : <CircleCheck size={18} className="mt-1 shrink-0" aria-hidden="true" />}
      <p>{message}</p>
    </div>
  );
}
