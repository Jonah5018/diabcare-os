import Link from "next/link";
import { getPlatformContext } from "@/lib/platform/context";
import { signOut } from "@/actions/auth";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getPlatformContext();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="space-y-4 bg-slate-950 p-4 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">DiabCare OS · Platform administration</p>
          <p className="text-sm">{profile.full_name}</p>
        </div>
        <nav aria-label="Platform navigation" className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/platform">Overview</Link>
          <Link href="/platform/organizations">Organizations</Link>
          <Link href="/platform/operations">Operations</Link>
          <Link href="/dashboard">Clinic workspace</Link>
          <form action={signOut}><button>Sign out</button></form>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">{children}</main>
    </div>
  );
}
