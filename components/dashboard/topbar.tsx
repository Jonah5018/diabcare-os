export default function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Welcome back 👋
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-full bg-slate-100 p-2">
          🔔
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 font-bold text-white">
            J
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-semibold">
              Jonathan
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