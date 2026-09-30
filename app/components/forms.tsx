"use client";

import { createContext, startTransition, useActionState, useContext, type FormEvent, type ReactNode } from "react";

/** Pending state for ActionForm, which submits via a transition (useFormStatus doesn't see it). */
const Pending = createContext(false);
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/auth";

export function SubmitButton({
  children,
  className = "btn",
  pendingText,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
}) {
  const status = useFormStatus();
  const viaTransition = useContext(Pending);
  const pending = status.pending || viaTransition;
  return (
    <button className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

/** A form wired to a server action that returns {error, ok}; shows the message inline. */
export function ActionForm({
  action,
  children,
  className = "stack",
  resetOnSuccess = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  // Submitting through onSubmit (instead of letting React run the action) stops React 19 from
  // clearing every field, so people keep what they typed when the server returns an error.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(data));
  };
  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className={className}
      key={resetOnSuccess && state.ok ? state.ok + Math.random() : undefined}
    >
      <Pending.Provider value={isPending}>{children}</Pending.Provider>
      {state.error && (
        <p className="form-msg error" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="form-msg ok" role="status">
          {state.ok}
        </p>
      )}
    </form>
  );
}
