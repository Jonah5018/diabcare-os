import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { workflowActions } from "@/lib/workspace/navigation";
import type { UserRole } from "@/lib/auth/permissions";

export default function WorkflowActions({ role }: { role: UserRole }) {
  return (
    <section aria-labelledby="workflow-heading" className="space-y-4">
      <div>
        <h2 id="workflow-heading" className="text-lg font-semibold tracking-tight text-slate-900">Your next step</h2>
        <p className="mt-1 text-sm text-slate-500">A focused starting point for your role.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {workflowActions(role).map(item => (
          <Link
            key={`${item.href}-${item.title}`}
            href={item.href}
            className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <ArrowUpRight size={18} className="shrink-0 text-slate-400 group-hover:text-sky-700" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{item.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
