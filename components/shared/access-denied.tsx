import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AccessDenied() {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <span className="mb-5 grid size-12 place-items-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-800">
        <ShieldCheck size={24} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Access restricted</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Your clinic role does not have access to this page. Contact your clinic administrator if you need additional access.
      </p>
      <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
        Return to dashboard
      </Link>
    </section>
  );
}
