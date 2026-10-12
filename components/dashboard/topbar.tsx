"use client";

import Link from "next/link";
import { Menu, Search, Settings } from "lucide-react";
import { roleLabels } from "@/lib/auth/permissions";
import type { WorkspaceAccount } from "./dashboard-shell";

export default function Topbar({ onMenu, account }: { onMenu: () => void; account: WorkspaceAccount }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenu} aria-label="Open navigation menu" className="rounded-lg border p-2 hover:bg-slate-100 md:hidden"><Menu className="h-5 w-5" /></button>
        <form action="/dashboard/patients" className="relative hidden md:block">
          <label htmlFor="workspace-search" className="sr-only">Search clinic patients</label>
          <input id="workspace-search" name="q" maxLength={80} placeholder="Search patients..." className="w-60 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-10 text-sm outline-none focus:border-sky-500 lg:w-72" />
          <button aria-label="Search patients" className="absolute right-2 top-2 p-1 text-slate-500"><Search className="h-4 w-4" /></button>
        </form>
        <p className="truncate text-sm font-medium text-slate-600 md:hidden">{account.clinicName}</p>
      </div>
      <Link href="/dashboard/settings" aria-label="Account and clinic settings" className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100">
        <Settings className="hidden h-5 w-5 text-slate-500 sm:block" />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 font-bold text-white">{account.fullName.slice(0, 1).toUpperCase()}</div>
        <div className="hidden lg:block"><p className="text-sm font-semibold text-slate-900">{account.fullName}</p><p className="text-xs text-slate-500">{roleLabels[account.role]}</p></div>
      </Link>
    </header>
  );
}
