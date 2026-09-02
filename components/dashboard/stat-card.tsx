interface StatCardProps {
  title: string;
  value: string | number;
}

export default function StatCard({
  title,
  value,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <h3 className="mt-3 text-3xl font-bold text-slate-900">
        {value}
      </h3>
    </div>
  );
}