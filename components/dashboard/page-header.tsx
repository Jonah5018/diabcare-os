interface HeaderProps {
  title: string;
  subtitle: string;
}

export default function PageHeader({
  title,
  subtitle,
}: HeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-slate-900">
        {title}
      </h1>

      <p className="mt-2 text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}