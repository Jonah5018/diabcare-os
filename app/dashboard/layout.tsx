export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-sky-700 text-white p-6">
        <h1 className="text-2xl font-bold">DiabCare OS</h1>

        <nav className="mt-10 space-y-4">
          <a href="/dashboard" className="block hover:text-sky-200">
            Dashboard
          </a>

          <a
            href="/dashboard/patients"
            className="block hover:text-sky-200"
          >
            Patients
          </a>

          <a href="#" className="block hover:text-sky-200">
            Appointments
          </a>

          <a href="#" className="block hover:text-sky-200">
            Consultations
          </a>

          <a href="#" className="block hover:text-sky-200">
            Laboratory
          </a>

          <a href="#" className="block hover:text-sky-200">
            Reports
          </a>
        </nav>
      </aside>

      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}