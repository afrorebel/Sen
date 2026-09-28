import Link from "next/link";
import type { ReactNode } from "react";

export const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);

export function Stat({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta != null && Math.abs(delta) >= 0.005 && (
        <div className={`delta ${delta > 0 ? "up" : "down"}`}>
          <span aria-hidden>{delta > 0 ? "▲" : "▼"}</span> {Math.abs(Math.round(delta * 100))} pts vs previous run
        </div>
      )}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "good" | "bad" | "warn" | "neutral"; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: { id: string; label: string }[] }) {
  return (
    <nav className="tabs-nav" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.id} href={t.id === tabs[0].id ? base : `${base}?tab=${t.id}`} aria-current={current === t.id ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Single-series trend line (0–100%). One series, so no legend: the card title names it.
 * Every point has a native tooltip with the date and value.
 */
export function TrendChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return null;
  const W = 640;
  const H = 180;
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - v * ih;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mention rate by run">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} className="grid" />
          <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" className="axis">
            {g * 100}%
          </text>
        </g>
      ))}
      <path d={path} className="line" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={4} className="dot" />
          <circle cx={x(i)} cy={y(p.value)} r={14} className="hit">
            <title>{`${p.label}: ${Math.round(p.value * 100)}%`}</title>
          </circle>
        </g>
      ))}
      {points.map((p, i) =>
        points.length <= 8 || i % Math.ceil(points.length / 8) === 0 || i === points.length - 1 ? (
          <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="axis">
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Horizontal share bars; the brand's own bar uses the accent, others the neutral hue. */
export function ShareBars({ rows }: { rows: { name: string; share: number; mentions: number; isOwn: boolean }[] }) {
  const max = Math.max(...rows.map((r) => r.share), 0.01);
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.name} title={`${r.name}: ${r.mentions} mentions (${pct(r.share)})`}>
          <span className="bar-label">
            <span className="bar-name">{r.name}</span>
            {r.isOwn && <span className="you">you</span>}
          </span>
          <span className="bar-track">
            <span className={`bar-fill ${r.isOwn ? "own" : ""}`} style={{ width: `${(r.share / max) * 100}%` }} />
          </span>
          <span className="bar-value">{pct(r.share)}</span>
        </div>
      ))}
    </div>
  );
}
