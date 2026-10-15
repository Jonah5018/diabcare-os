"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef } from "react";
import { createFollowUp } from "@/actions/follow-up";
import type { FollowUpResult } from "@/types/follow-up";

export default function FollowUpForm({ patientId, consultationId, today }: {
  patientId: string;
  consultationId?: string;
  today: string;
}) {
  const [state, dispatch, pending] = useActionState<FollowUpResult, FormData>(createFollowUp, {});
  const requestId = useRef<string | null>(null);

  if (state.success) {
    return (
      <div className="space-y-3 rounded-xl border bg-white p-5">
        <p role="status" className="text-emerald-700">{state.success}</p>
        <Link href={`/dashboard/patients/${patientId}#follow-ups`} className="text-sky-700 underline">Review follow-up history</Link>
      </div>
    );
  }

  return (
    <form className="space-y-4 rounded-xl border bg-white p-5" aria-busy={pending}
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        requestId.current ??= crypto.randomUUID();
        data.set("request_id", requestId.current);
        data.set("patient_id", patientId);
        data.set("consultation_id", consultationId ?? "");
        startTransition(() => dispatch(data));
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <legend className="mb-3 font-semibold">Plan a follow-up</legend>
        <div>
          <label htmlFor="follow-up-date" className="mb-1 block text-sm font-medium">Follow-up date</label>
          <input id="follow-up-date" name="due_date" type="date" min={today} max="2100-12-31"
            defaultValue={today} required className="w-full rounded-xl border p-3 sm:w-auto" />
        </div>
        <div>
          <label htmlFor="follow-up-reason" className="mb-1 block text-sm font-medium">Follow-up reason</label>
          <textarea id="follow-up-reason" name="reason" required maxLength={2000} rows={3}
            className="w-full rounded-xl border p-3" />
        </div>
        <p className="text-sm text-slate-500">
          {consultationId ? "Linked to the selected saved consultation." : "Standalone patient follow-up. Use Consultation History to link a plan to a saved consultation."}
          {" "}Planning does not book an appointment or send a reminder.
        </p>
        <button type="submit" className="rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white">Save plan</button>
      </fieldset>
      {pending ? <p role="status" className="text-sm text-slate-500">Saving follow-up...</p> : null}
      {state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}</p> : null}
    </form>
  );
}
