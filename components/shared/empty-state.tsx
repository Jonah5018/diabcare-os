import type { ReactNode } from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

export default function EmptyState({ title, description, children, href, label }: {
  title: string;
  description: string;
  children?: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <section role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <FolderOpen size={23} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p>
      {href && label ? (
        <Link href={href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
          {label}
        </Link>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
