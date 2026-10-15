export default function ClinicalReviewLoading() {
  return (
    <div role="status" aria-label="Loading clinical review" className="space-y-6 motion-safe:animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200" aria-hidden="true" />
      <div className="grid gap-4 xl:grid-cols-3">
        {[1, 2, 3].map(index => (
          <div key={index} className="h-60 rounded-2xl border bg-white" aria-hidden="true" />
        ))}
      </div>
      <p className="text-sm text-slate-500">Loading the patient’s bounded source preview…</p>
    </div>
  );
}
