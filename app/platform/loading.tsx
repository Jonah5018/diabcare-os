export default function PlatformLoading() {
  return (
    <div role="status" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-slate-200" aria-hidden="true" />
      <div className="h-40 rounded-2xl border border-slate-200 bg-white" aria-hidden="true" />
      <p className="text-sm text-slate-500">Loading platform administration…</p>
    </div>
  );
}
