"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import Sidebar from "@/components/dashboard/sidebar";
import Topbar from "@/components/dashboard/topbar";
import type { UserRole } from "@/lib/auth/permissions";

export type WorkspaceAccount = { fullName: string; role: UserRole; clinicName: string };

export default function DashboardShell({ children, account }: { children: React.ReactNode; account: WorkspaceAccount }) {
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const links = drawer.current?.querySelectorAll<HTMLElement>("a, button");
      if (!links?.length) return;
      const first = links[0], last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    const desktop = window.matchMedia("(min-width: 768px)");
    const handleResize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", handleKey);
    desktop.addEventListener("change", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", handleResize);
      previous?.focus();
    };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden md:block"><Sidebar account={account} /></div>
      {open ? (
        <>
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/40 md:hidden" />
          <div ref={drawer} role="dialog" aria-modal="true" aria-label="Clinic navigation" className="fixed left-0 top-0 z-50 md:hidden">
            <button type="button" aria-label="Close navigation menu" onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white hover:bg-slate-800"><X className="h-5 w-5" /></button>
            <Sidebar account={account} onNavigate={() => setOpen(false)} />
          </div>
        </>
      ) : null}
      <div inert={open || undefined} className="flex min-w-0 flex-1 flex-col">
        <Topbar account={account} onMenu={() => setOpen(true)} />
        <main id="main-content" className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
