"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-xl rounded-2xl border bg-white p-8"><h1 className="text-2xl font-bold text-slate-900">Unable to load this clinic page</h1><p className="mt-3 text-slate-600">Please try again. If the problem continues, contact your clinic administrator.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={reset} className="rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white">Try again</button><Link href="/dashboard" className="rounded-xl border px-5 py-3 text-slate-700">Return to dashboard</Link></div></section>;
}
