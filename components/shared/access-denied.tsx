import Link from "next/link";

export default function AccessDenied() {
  return <section className="mx-auto max-w-xl rounded-2xl border bg-white p-8"><h1 className="text-2xl font-bold text-slate-900">Access restricted</h1><p className="mt-3 text-slate-600">Your clinic role does not have access to this page. Contact your clinic administrator if you need additional access.</p><Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-sky-600 px-5 py-3 font-medium text-white">Return to dashboard</Link></section>;
}
