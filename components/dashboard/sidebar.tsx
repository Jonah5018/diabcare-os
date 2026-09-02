import Link from "next/link";

const menu = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Patients", href: "/dashboard/patients" },
  { name: "Appointments", href: "#" },
  { name: "Consultations", href: "#" },
  { name: "Laboratory", href: "#" },
  { name: "Reports", href: "#" },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-64 flex-col bg-slate-900 text-white">
      <div className="border-b border-slate-800 p-6">
        <h1 className="text-2xl font-bold text-sky-400">
          DiabCare OS
        </h1>

        <p className="mt-1 text-xs text-slate-400">
          Diabetes Healthcare Platform
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {menu.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block rounded-xl px-4 py-3 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl bg-slate-800 p-3">
          <p className="text-xs text-slate-400">
            Logged in as
          </p>

          <p className="mt-1 font-medium">
            Platform Owner
          </p>
        </div>
      </div>
    </aside>
  );
}