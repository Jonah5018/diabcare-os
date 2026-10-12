"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, Stethoscope, FlaskConical, FileBarChart, HeartPulse, Settings, UserRoundCog, LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/actions/auth";
import { can, roleLabels, type Permission } from "@/lib/auth/permissions";
import type { WorkspaceAccount } from "./dashboard-shell";

const menu = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Patients", href: "/dashboard/patients", icon: Users },
  { name: "Appointments", href: "/dashboard/appointments", icon: CalendarDays },
  { name: "Consultations", href: "/dashboard/consultations", icon: Stethoscope },
  { name: "Laboratory", href: "/dashboard/laboratory", icon: FlaskConical },
  { name: "Reports", href: "/dashboard/reports", icon: FileBarChart, permission: "reports:view" as Permission },
  { name: "Team", href: "/dashboard/team", icon: UserRoundCog, permission: "team:view" as Permission },
  { name: "Audit History", href: "/dashboard/audit", icon: ShieldCheck, permission: "team:view" as Permission },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar({ account, onNavigate }: { account: WorkspaceAccount; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-dvh w-[280px] flex-col bg-slate-950 text-white shadow-2xl">
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-500 p-2.5"><HeartPulse className="h-6 w-6" /></div>
          <div className="min-w-0"><p className="text-xl font-bold tracking-tight">DiabCare OS</p><p className="mt-1 truncate text-xs text-slate-400">{account.clinicName}</p></div>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto p-4">
        {menu.filter(item => !item.permission || can(account.role, item.permission)).map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} href={item.href} onNavigate={onNavigate} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${active ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}><Icon className="h-5 w-5 shrink-0" /><span>{item.name}</span></Link>;
        })}
      </nav>
      <div className="border-t border-slate-800 p-5">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-900 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 font-bold">{account.fullName.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0"><p className="truncate font-semibold">{account.fullName}</p><p className="text-xs text-sky-400">{roleLabels[account.role]}</p></div>
        </div>
        <form action={signOut}><button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"><LogOut className="h-4 w-4" />Sign out</button></form>
      </div>
    </aside>
  );
}
