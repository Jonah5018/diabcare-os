"use client";

import Link from "next/link";
import type { Ref } from "react";
import { Menu, Search, Settings, ShieldCheck } from "lucide-react";
import { roleLabels } from "@/lib/auth/permissions";
import type { WorkspaceAccount } from "./dashboard-shell";

export default function Topbar({ onMenu, account, menuOpen = false, menuButtonRef }: {
  onMenu: () => void;
  account: WorkspaceAccount;
  menuOpen?: boolean;
  menuButtonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenu}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="clinic-navigation-drawer"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 md:hidden"
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <div className="hidden items-center gap-2 text-xs text-slate-500 xl:flex">
          <ShieldCheck size={16} className="text-sky-800" aria-hidden="true" />
          <span className="max-w-48 truncate">{account.clinicName}</span>
        </div>
        <form action="/dashboard/patients" className="relative hidden md:block">
          <label htmlFor="workspace-search" className="sr-only">Search clinic patients</label>
          <input
            id="workspace-search"
            name="q"
            type="search"
            maxLength={80}
            placeholder="Find a patient…"
            className="min-h-11 w-56 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-base text-slate-800 outline-none focus:border-sky-600 lg:w-64"
          />
          <button type="submit" aria-label="Search patients" className="absolute inset-y-0 right-1 my-auto grid size-11 place-items-center rounded-lg text-slate-500 hover:text-sky-800">
            <Search size={17} aria-hidden="true" />
          </button>
        </form>
        <p className="truncate text-sm font-medium text-slate-700 md:hidden">{account.clinicName}</p>
      </div>

      <Link href="/dashboard/settings" aria-label="Account and clinic settings" className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl p-1.5 hover:bg-slate-50">
        <Settings size={18} className="hidden text-slate-400 sm:block" aria-hidden="true" />
        <span className="grid size-10 place-items-center rounded-xl border border-sky-100 bg-sky-50 text-sm font-semibold text-sky-900">
          {account.fullName.slice(0, 1).toUpperCase()}
        </span>
        <div className="hidden max-w-40 lg:block">
          <p className="truncate text-xs font-semibold text-slate-900">{account.fullName}</p>
          <p className="mt-1 text-[10px] text-slate-500">{roleLabels[account.role]}</p>
        </div>
      </Link>
    </header>
  );
}
