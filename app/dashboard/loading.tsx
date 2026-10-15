export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading clinic workspace" className="space-y-6 motion-safe:animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(item => <div key={item} className="h-36 rounded-2xl border border-slate-200 bg-white" />)}
      </div>
      <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
      <span className="sr-only">Loading your clinic workspace…</span>
    </div>
  );
}
