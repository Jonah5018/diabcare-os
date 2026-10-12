import { signOut } from "@/actions/auth";

export default function AccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8">
        <h1 className="text-2xl font-bold text-slate-900">Clinic access unavailable</h1>
        <p className="mt-3 text-slate-600">Your account needs an active clinic profile. Contact your clinic administrator to restore access or assign your clinic.</p>
        <form action={signOut}><button className="mt-6 w-full rounded-xl bg-sky-600 p-3 font-semibold text-white">Sign out</button></form>
      </section>
    </main>
  );
}
