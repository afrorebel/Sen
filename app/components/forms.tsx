"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/auth";

export function SubmitButton({ children, className = "btn", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending}>
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
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state.ok ? state.ok + Math.random() : undefined}
    >
      {children}
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
