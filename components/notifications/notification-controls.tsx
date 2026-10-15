"use client";

import { startTransition, useActionState, useRef } from "react";
import { processClinicNotifications, queueClinicNotice } from "@/actions/notification";
import type { AdministrationResult } from "@/types/onboarding";

export default function NotificationControls() {
  const requestId = useRef<string | null>(null);
  const [state, dispatch, pending] = useActionState(async (_previous: AdministrationResult, form: FormData) => {
    if (form.get("operation") === "process") return processClinicNotifications();
    const result = await queueClinicNotice(form);
    if (result.success) requestId.current = null;
    return result;
  }, {});

  return (
    <form aria-busy={pending} className="space-y-3 rounded-xl border bg-white p-5"
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        requestId.current ??= crypto.randomUUID();
        form.set("request_id", requestId.current);
        startTransition(() => dispatch(form));
      }}>
      <p className="text-sm text-slate-600">Process up to 10 due internal notifications. Future events wait for their due time. Patient email/SMS delivery is not configured.</p>
      <div className="flex flex-wrap gap-3">
        <button name="operation" value="process" disabled={pending} className="rounded-lg bg-sky-600 px-4 py-2 text-white">Process due clinic notifications</button>
        <button name="operation" value="notice" disabled={pending} className="rounded-lg border px-4 py-2">Queue an internal clinic notice</button>
      </div>
      {pending ? <p role="status">Processing...</p> : null}
      {state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  );
}
