"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setIsError(false);
    setMessage("Login successful!");

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-slate-900">DiabCare OS</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to your clinic workspace
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm font-medium">Email</label>
            <input
              id="login-email" type="email" autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm font-medium">Password</label>
            <input
              id="login-password" type="password" autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-center text-sm font-medium ${isError ? "text-red-600" : "text-emerald-600"
              }`}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
