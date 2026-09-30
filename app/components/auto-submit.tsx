"use client";

import type { ReactNode } from "react";

/** A GET form that submits itself whenever a select changes (filters without a separate Apply button). */
export function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form
      method="get"
      className={className}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") (e.currentTarget as HTMLFormElement).requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
