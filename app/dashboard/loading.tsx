export default function DashboardLoading() {
  return <div role="status" aria-label="Loading clinic workspace" className="animate-pulse space-y-6"><div className="h-8 w-48 rounded-lg bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-36 rounded-2xl border bg-white" />)}</div><div className="h-64 rounded-2xl border bg-white" /><span className="sr-only">Loading...</span></div>;
}
