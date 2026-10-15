"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signInWithEmail } from "@/lib/auth/browser-flows";
import AuthFeedback from "./auth-feedback";
import PasswordField from "./password-field";
import { authButtonClass, authInputClass, authLabelClass, authLinkClass } from "./form-styles";

export default function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");

    try {
      const result = await signInWithEmail(
        createClient(),
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
      );
      if (result.error) {
        setError(result.error);
        setPending(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sign in is temporarily unavailable. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-5" aria-busy={pending}>
      <div>
        <label htmlFor="login-email" className={authLabelClass}>Work email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          readOnly={pending}
          placeholder="you@clinic.com"
          className={authInputClass}
        />
      </div>

      <div>
        <PasswordField
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          readOnly={pending}
        />
        <div className="mt-1 flex justify-end">
          <Link href="/auth/forgot-password" className={authLinkClass}>Forgot password?</Link>
        </div>
      </div>

      {error ? <AuthFeedback message={error} error /> : null}

      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : null}
        <span role="status">{pending ? "Signing you in…" : "Sign in to workspace"}</span>
        {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
      </button>

      <p className="pt-2 text-center text-xs leading-6 text-slate-500">
        Access is provided by your clinic administrator.<br />
        <Link href="/auth/invitation" className={`${authLinkClass} text-xs`}>Have a private invitation?</Link>
      </p>
    </form>
  );
}
