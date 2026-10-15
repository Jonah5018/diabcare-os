"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { acceptInvitation } from "@/actions/invitation";

export default function InvitationAcceptance() {
  const tokenInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value && /^[a-f0-9]{64}$/.test(value) && tokenInput.current) tokenInput.current.value = value;
    // Keep the bearer secret out of HTTP requests, browser history and referrers.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function authenticate(createAccount: boolean) {
    if (pending) return;
    if (!email.trim() || !password || (createAccount && password.length < 12)) {
      setMessage("Enter the invited email and password. New account passwords need at least 12 characters.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const client = createClient();
      const result = createAccount
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
        : await client.auth.signInWithPassword({ email, password });
      setMessage(result.error
        ? "Authentication could not be completed. Check the credentials or contact your administrator."
        : createAccount ? "Check your email for confirmation. After confirming, return to this invitation and sign in before accepting." : "Signed in. You may now accept with your verified invited email.");
    } catch {
      setMessage("Authentication is temporarily unavailable.");
    } finally {
      setPassword("");
      setPending(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border bg-white p-6">
      <h1 className="text-2xl font-bold">Accept clinic invitation</h1>
      <p className="text-sm text-slate-600">Use the exact invited email and confirm it through Supabase Auth. Existing clinic profiles cannot move to another clinic through an invitation.</p>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void authenticate(false); }}>
        <fieldset disabled={pending} className="space-y-3">
          <label htmlFor="invited-email" className="block text-sm font-medium">Invited email</label>
          <input id="invited-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border p-3" autoComplete="username" />
          <label htmlFor="invited-password" className="block text-sm font-medium">Password</label>
          <input id="invited-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border p-3" autoComplete="current-password" />
          <div className="flex flex-wrap gap-3">
            <button className="rounded-lg bg-sky-600 px-4 py-2 text-white">Sign in</button>
            <button type="button" className="rounded-lg border px-4 py-2" onClick={() => void authenticate(true)}>Create Auth account</button>
          </div>
        </fieldset>
      </form>
      <form className="space-y-3" onSubmit={async event => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        try {
          const form = new FormData();
          form.set("token", tokenInput.current?.value ?? "");
          const result = await acceptInvitation(form);
          setMessage(result.error ?? result.success ?? "Acceptance unavailable.");
          setAccepted(Boolean(result.success));
        } catch {
          setMessage("Acceptance could not be confirmed. Check your clinic access before retrying.");
        } finally {
          setPending(false);
        }
      }}>
        <label htmlFor="invitation-secret" className="block text-sm font-medium">Invitation secret</label>
        <input ref={tokenInput} id="invitation-secret" type="password" required maxLength={64} autoComplete="off" className="w-full rounded-lg border p-3" />
        <button disabled={pending || accepted} className="rounded-lg bg-sky-600 px-4 py-2 text-white">Accept invitation</button>
      </form>
      {pending ? <p role="status">Working...</p> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {accepted ? <Link href="/dashboard" className="text-sky-700 underline">Open clinic workspace</Link> : null}
      <p className="text-xs text-slate-500">If a confirmation email opens another page, reopen the original private invitation link. Secrets are not stored in local storage.</p>
    </section>
  );
}
