import Link from "next/link";
export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="max-w-md rounded-2xl border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Page or record unavailable</h1><p className="mt-3 text-slate-500">The page may have moved, or this record is not available in your clinic.</p><Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-sky-600 px-5 py-3 font-medium text-white">Return to workspace</Link></section></main>;
}
