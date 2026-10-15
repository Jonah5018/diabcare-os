"use client";

export default function PlatformError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Platform administration could not be loaded.</h1>
      <p className="mt-3 text-sm leading-7 text-slate-500">Refresh the metadata before retrying an operational change.</p>
      <button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Try again</button>
    </section>
  );
}
