import Link from "next/link";

export default function EmptyState({ title, description, href, label }: {
  title: string; description: string; href?: string; label?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{description}</p>
      {href && label ? <Link href={href} className="mt-5 inline-block rounded-xl bg-sky-600 px-5 py-3 font-medium text-white">{label}</Link> : null}
    </div>
  );
}
