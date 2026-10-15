import Link from "next/link";
import PageHeader from "@/components/dashboard/page-header";
import Pagination from "@/components/shared/pagination";
import { getPlatformOrganizations } from "@/lib/platform/queries";
import { encodeCursor, scalar, type SearchParams } from "@/lib/pagination";

export default async function OrganizationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = await getPlatformOrganizations(scalar(params.cursor)).catch(() => null);
  const last = page?.rows.at(-1);
  return (
    <div className="space-y-6">
      <PageHeader title="Organizations" subtitle="Bounded global clinic administration directory" />
      {page ? <>
        {page.rows.length ? <div className="space-y-3">
          {page.rows.map(clinic => (
            <article key={clinic.id} className="flex flex-wrap justify-between gap-3 rounded-xl border bg-white p-5">
              <Link href={`/platform/organizations/${clinic.id}`} className="font-medium text-sky-700 underline">{clinic.name}</Link>
              <p className="text-sm">{clinic.operational_status} · {clinic.subscription_status ?? "Billing not configured"}</p>
            </article>
          ))}
        </div> : <p>No organizations found.</p>}
        <Pagination path="/platform/organizations" hasMore={page.hasMore} cursor={last ? encodeCursor(last) : undefined} />
      </> : <p role="alert">Unable to load organizations. Refresh or clear the cursor.</p>}
    </div>
  );
}
