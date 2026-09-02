"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  FlaskConical,
  FileBarChart,
  HeartPulse,
} from "lucide-react";

const menu = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Patients", href: "/dashboard/patients", icon: Users },
  { name: "Appointments", href: "/dashboard/appointments", icon: CalendarDays },
  { name: "Consultations", href: "/dashboard/consultations", icon: Stethoscope },
  { name: "Laboratory", href: "/dashboard/laboratory", icon: FlaskConical },
  { name: "Reports", href: "/dashboard/reports", icon: FileBarChart },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[280px] flex-col bg-slate-950 text-white shadow-2xl">
      {/* Logo */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-500 p-2.5">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">
              DiabCare OS
            </h1>
            <p className="text-xs text-slate-400">
              Diabetes Healthcare Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4">
        {menu.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all duration-200 ${
                active
                  ? "bg-sky-600 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition ${
                  active
                    ? "text-white"
                    : "text-slate-400 group-hover:text-white"
                }`}
              />

              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Card */}
      <div className="border-t border-slate-800 p-5">
        <div className="rounded-2xl bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-600 font-bold text-white">
              J
            </div>

            <div className="min-w-0">
              <p className="truncate font-semibold">
                Jonathan Uchenna
              </p>
              <p className="text-xs text-sky-400">
                Platform Owner
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}