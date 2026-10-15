"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { FormResult } from "@/types/forms";

export default function ActionForm({ action, children, className }: {
  action: (data: FormData) => Promise<FormResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (_previous: FormResult, data: FormData) => action(data), {});

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      className={className}
      aria-busy={pending}
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;

        // Keep the entered clinical values when validation or saving fails.
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        {children}
      </fieldset>
      {pending ? (
        <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Saving record…
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-900">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
