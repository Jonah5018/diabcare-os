"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Bell, Building2, CalendarClock, CalendarDays, CreditCard,
  FileBarChart, FlaskConical, LayoutDashboard, LogOut, Settings,
  ShieldCheck, Stethoscope, Users, UserRoundCog, type LucideIcon,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { roleLabels } from "@/lib/auth/permissions";
import { navigationForRole } from "@/lib/workspace/navigation";
import type { WorkspaceAccount } from "./dashboard-shell";

const icons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/patients": Users,
  "/dashboard/appointments": CalendarDays,
  "/dashboard/follow-ups": CalendarClock,
  "/dashboard/consultations": Stethoscope,
  "/dashboard/laboratory": FlaskConical,
  "/dashboard/notifications": Bell,
  "/dashboard/reports": FileBarChart,
  "/dashboard/settings": Settings,
  "/dashboard/team": UserRoundCog,
  "/dashboard/audit": ShieldCheck,
  "/dashboard/billing": CreditCard,
  "/dashboard/clinics": Building2,
  "/platform": ShieldCheck,
};

export default function Sidebar({ account, onNavigate }: {
  account: WorkspaceAccount;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const menu = navigationForRole(account.role);

  return (
    <aside className="sticky top-0 flex h-dvh w-64 flex-col border-r border-slate-800 bg-[linear-gradient(160deg,#142b40,#0a1526_65%)] text-white lg:w-[272px]">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-100/5 text-cyan-200">
            <Activity size={23} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">DiabCare <span className="font-normal text-slate-400">OS</span></p>
            <p className="mt-1 truncate text-[11px] text-slate-400">{account.clinicName}</p>
          </div>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {(["Care workspace", "Workspace", "Administration"] as const).map(section => {
          const items = menu.filter(item => item.section === section);
          if (!items.length) return null;

          return (
            <div key={section}>
              <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">{section}</p>
              <div className="space-y-1">
                {items.map(item => {
                  const Icon = icons[item.href];
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onNavigate={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${active ? "border-cyan-200/15 bg-cyan-100/10 text-cyan-100" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}
                    >
                      <Icon size={18} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-700/70 text-sm font-medium text-sky-100">
            {account.fullName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{account.fullName}</p>
            <p className="mt-1 text-[10px] text-slate-400">{roleLabels[account.role]}</p>
          </div>
        </div>
        <form action={signOut}>
          <button type="submit" className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs text-slate-300 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-cyan-200">
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
