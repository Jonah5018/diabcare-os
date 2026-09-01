export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-slate-800">
        Welcome to DiabCare OS
      </h2>

      <p className="mt-2 text-slate-600">
        Platform Owner Dashboard
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Organizations</p>
          <h3 className="mt-2 text-3xl font-bold">1</h3>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Patients</p>
          <h3 className="mt-2 text-3xl font-bold">0</h3>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Doctors</p>
          <h3 className="mt-2 text-3xl font-bold">0</h3>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Appointments</p>
          <h3 className="mt-2 text-3xl font-bold">0</h3>
        </div>
      </div>
    </div>
  );
}