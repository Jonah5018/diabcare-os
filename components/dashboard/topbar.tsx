"use client";

import { Bell, Menu, Search } from "lucide-react";

interface TopbarProps {
  onMenu: () => void;
}

export default function Topbar({ onMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patients..."
            className="w-72 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button className="relative rounded-full border border-slate-200 p-2 transition hover:bg-slate-100">
          <Bell className="h-5 w-5 text-slate-700" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 font-bold text-white">
            J
          </div>

          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-900">
              Jonathan Uchenna
            </p>
            <p className="text-xs text-slate-500">
              Platform Owner
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}