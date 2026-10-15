import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";
import { getPlatformContext } from "@/lib/platform/context";
import { signOut } from "@/actions/auth";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getPlatformContext();

  return (
    <div className="clinic-workspace min-h-screen min-w-0 bg-slate-50">
      <header className="border-b border-slate-800 bg-[linear-gradient(120deg,#142b40,#0a1526)] text-white">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-cyan-200/20 text-cyan-200">
                <Activity size={23} aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight">DiabCare OS</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-slate-400">Platform administration</p>
              </div>
            </div>
            <p className="max-w-full break-words text-xs text-slate-300">{profile.full_name}</p>
          </div>
          <nav aria-label="Platform navigation" className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { href: "/platform", title: "Overview" },
              { href: "/platform/organizations", title: "Organizations" },
              { href: "/platform/operations", title: "Operations" },
            ].map(item => (
              <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 hover:bg-white/10">{item.title}</Link>
            ))}
            <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-slate-300 hover:bg-white/5">
              <ArrowLeft size={14} aria-hidden="true" /> Clinic workspace
            </Link>
            <form action={signOut} className="sm:ml-auto">
              <button type="submit" className="min-h-11 rounded-xl px-4 text-slate-300 hover:bg-white/5">Sign out</button>
            </form>
          </nav>
          <p className="text-xs leading-6 text-slate-400">Organization metadata and operational controls. Clinical records remain within their assigned clinic.</p>
        </div>
      </header>
      <main id="main-content" className="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-6 lg:py-8">{children}</main>
    </div>
  );
}
