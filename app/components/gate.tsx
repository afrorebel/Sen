import Link from "next/link";
import type { ReactNode } from "react";
import { planWith, type Feature } from "@/lib/plans";

const LOCK = "M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z";

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={LOCK} />
    </svg>
  );
}

/**
 * Wraps a paid section. When locked, the real content is shown blurred behind an upgrade card,
 * so Free users can see what they're missing without being able to use it.
 */
export function Gate({
  locked,
  feature,
  title,
  body,
  billingHref,
  canUpgrade,
  children,
  compact = false,
}: {
  locked: boolean;
  feature: Feature;
  title: string;
  body: string;
  billingHref: string;
  canUpgrade: boolean;
  children: ReactNode;
  compact?: boolean;
}) {
  if (!locked) return <>{children}</>;
  const plan = planWith(feature);
  return (
    <div className={`gate ${compact ? "compact" : ""}`}>
      <div className="gate-preview" aria-hidden inert>
        {children}
      </div>
      <div className="gate-card card" role="region" aria-label={`${title} (${plan.name} feature)`}>
        <span className="gate-badge">
          <LockIcon /> {plan.name}
        </span>
        <h3>{title}</h3>
        <p>{body}</p>
        {canUpgrade ? (
          <Link className="btn small" href={billingHref}>
            Upgrade to {plan.name}
          </Link>
        ) : (
          <p className="muted small">Ask the workspace owner to upgrade.</p>
        )}
      </div>
    </div>
  );
}

/** A small inline upgrade prompt for limits (e.g. out of re-checks). */
export function UpgradeNote({ children, billingHref, canUpgrade }: { children: ReactNode; billingHref: string; canUpgrade: boolean }) {
  return (
    <div className="upgrade-note">
      <LockIcon />
      <span>{children}</span>
      {canUpgrade && (
        <Link href={billingHref} className="upgrade-link">
          Upgrade
        </Link>
      )}
    </div>
  );
}
