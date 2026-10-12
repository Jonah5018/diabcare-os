import Link from "next/link";

export default function Pagination({ path, cursor, hasMore, query = {}, parameter = "cursor" }: {
  path: string;
  cursor?: string;
  hasMore: boolean;
  query?: Record<string, string>;
  parameter?: string;
}) {
  const href = (next?: string) => {
    const params = new URLSearchParams(query);
    params.delete(parameter);
    if (next) params.set(parameter, next);
    return `${path}${params.size ? `?${params}` : ""}`;
  };

  return (
    <nav aria-label="Record pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <Link href={href()} className="rounded-lg border bg-white px-4 py-2 text-slate-700 hover:bg-slate-50">Latest records</Link>
      {hasMore && cursor ? (
        <Link href={href(cursor)} className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">Older records</Link>
      ) : <p className="text-slate-500">End of results</p>}
    </nav>
  );
}
