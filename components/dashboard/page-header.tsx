interface HeaderProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

export default function PageHeader({
  title,
  subtitle,
  eyebrow = "DIABCARE OS / WORKSPACE",
}: HeaderProps) {
  return (
    <div className="min-w-0">
      <p className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500">{eyebrow}</p>
      <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
        {title}
      </h1>

      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">{subtitle}</p>
    </div>
  );
}
