"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <CircleAlert size={26} strokeWidth={1.5} className="mb-5 text-slate-500" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Unable to load this clinic page</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Please try again. If the problem continues, contact your clinic administrator. Avoid resubmitting a clinical record until you have checked its history.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Try again</button>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-700">Return to dashboard</Link>
      </div>
    </section>
  );
}
