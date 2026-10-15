"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { endRecoverySession, recoveryUnavailableMessage, updateRecoveredPassword } from "@/lib/auth/browser-flows";
import AuthFeedback from "./auth-feedback";
import PasswordField from "./password-field";
import { authButtonClass, authLinkClass } from "./form-styles";

export default function ResetPasswordForm({ canReset }: { canReset: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(!canReset);
  const [updated, setUpdated] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || expired || updated) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError("");

    try {
      const result = await updateRecoveredPassword(
        createClient(),
        String(form.get("password") ?? ""),
        String(form.get("confirmation") ?? ""),
      );

      if (result.error) {
        setError(result.error);
        if (result.expired) setExpired(true);
        return;
      }

      formElement.reset();
      setUpdated(true);
      setSignedOut(Boolean(result.signedOut));
    } catch {
      setError("Password recovery is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function retrySignOut() {
    setPending(true);
    try {
      setSignedOut(await endRecoverySession(createClient()));
    } catch {
      setSignedOut(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {updated ? (
        <div className="space-y-5">
          <AuthFeedback message="Your password has been updated. You can now sign in with your new password." />
          {!signedOut ? (
            <div className="space-y-3">
              <p role="status" className="text-sm leading-6 text-slate-600">
                Your password changed, but we couldn’t end this browser session. Please sign out before leaving a shared device.
              </p>
              <button type="button" disabled={pending} onClick={retrySignOut} className={authButtonClass}>
                {pending ? "Signing out…" : "Sign out of this browser"}
              </button>
            </div>
          ) : null}
          <Link href="/auth/login" className={authButtonClass}>
            Back to sign in <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      ) : expired ? (
        <div className="space-y-5">
          <AuthFeedback message={recoveryUnavailableMessage} error />
          <Link href="/auth/forgot-password" className={authButtonClass}>
            Request a new reset link <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-5" aria-busy={pending}>
          <PasswordField
            id="new-password"
            name="password"
            label="New password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            readOnly={pending}
            aria-describedby="password-guidance"
          />
          <p id="password-guidance" className="text-xs leading-6 text-slate-600">
            Use 12–128 characters. A long, unique passphrase works well. Avoid passwords you use elsewhere. Your clinic’s password policy may require more.
          </p>
          <PasswordField
            id="confirm-password"
            name="confirmation"
            label="Confirm new password"
            autoComplete="new-password"
            maxLength={128}
            required
            readOnly={pending}
          />
          {error ? <AuthFeedback message={error} error /> : null}
          <button type="submit" disabled={pending} className={authButtonClass}>
            {pending ? <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : null}
            <span role="status">{pending ? "Updating your password…" : "Update password"}</span>
            {!pending ? <ArrowRight size={17} aria-hidden="true" /> : null}
          </button>
        </form>
      )}

      {!updated ? (
        <div className="text-center">
          <Link href="/auth/login" className={authLinkClass}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
          </Link>
        </div>
      ) : null}
    </div>
  );
}
