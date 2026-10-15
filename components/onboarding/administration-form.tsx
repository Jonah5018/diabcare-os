"use client";

import { startTransition, useActionState, useState } from "react";
import type { AdministrationResult } from "@/types/onboarding";

export default function AdministrationForm({ action, children }: {
  action: (form: FormData) => Promise<AdministrationResult>;
  children: React.ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(async (_previous: AdministrationResult, form: FormData) => action(form), {});
  const [copyMessage, setCopyMessage] = useState("");

  return (
    <form className="space-y-4 rounded-xl border bg-white p-5" aria-busy={pending}
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        setCopyMessage("");
        startTransition(() => dispatch(data));
      }}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">{children}</fieldset>
      {pending ? <p role="status">Saving...</p> : null}
      {state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-emerald-700">{state.success}</p> : null}
      {state.invitationPath ? (
        <div className="space-y-3 rounded-lg bg-sky-50 p-4">
          <p className="text-sm">This secret is shown only now. Share it privately with the named recipient; do not paste it into public logs or tickets.</p>
          <input aria-label="Private invitation path" readOnly value={state.invitationPath} className="w-full rounded-lg border p-2 text-xs" />
          <button type="button" className="rounded-lg border bg-white px-4 py-2 text-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(new URL(state.invitationPath!, window.location.origin).href);
                setCopyMessage("Private invitation link copied.");
              } catch {
                setCopyMessage("Copy the path above and add this site's origin manually.");
              }
            }}>Copy private link</button>
          <p role="status" className="text-sm">{copyMessage}</p>
        </div>
      ) : null}
    </form>
  );
}
