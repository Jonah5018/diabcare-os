"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { requestPasswordReset, resetRequestMessage } from "@/lib/auth/browser-flows";
import AuthFeedback from "./auth-feedback";
import { authButtonClass, authInputClass, authLabelClass, authLinkClass } from "./form-styles";

export default function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || sent) return;

    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setError("");

    try {
      const result = await requestPasswordReset(createClient(), email, window.location.origin);
      if (result.error) setError(result.error);
      else setSent(true);
    } catch {
      // Configuration and transport failures share the same non-enumerating result.
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {sent ? (
        <div className="space-y-5">
          <div className="grid size-14 place-items-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-800">
            <Mail size={24} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <AuthFeedback message={resetRequestMessage} />
          <p className="text-sm leading-7 text-slate-600">
            Check your inbox and spam folder. Open the link in this same browser to continue securely.
          </p>
          <p className="text-xs leading-6 text-slate-500">
            If it doesn’t arrive, wait a few minutes before trying again, or contact your clinic administrator.
          </p>
        </div>
      ) : (
        <form onSubmit={handleRequest} className="space-y-5" aria-busy={pending}>
          <div>
            <label htmlFor="recovery-email" className={authLabelClass}>Account email</label>
            <input
              id="recovery-email"
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
          {error ? <AuthFeedback message={error} error /> : null}
          <button disabled={pending} type="submit" className={authButtonClass}>
            {pending ? <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : null}
            <span role="status">{pending ? "Sending your request…" : "Send reset link"}</span>
            {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
          </button>
        </form>
      )}

      <div className="text-center">
        <Link href="/auth/login" className={authLinkClass}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
