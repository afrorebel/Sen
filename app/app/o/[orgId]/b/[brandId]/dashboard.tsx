import Link from "next/link";
import { recommendationToTask, setRecommendationState } from "@/app/actions/brands";
import { SubmitButton } from "@/app/components/forms";
import { EngineIcon, Favicon } from "@/app/components/logo";
import { Empty, TrendChart, pct } from "@/app/components/ui";
import type { CheckResult } from "@/lib/audit/types";
import { COUNTRIES } from "@/lib/locations";
import { ENGINES, ENGINE_IDS, isEngine } from "@/lib/tracking/engines";
import type { BrandReport, Recommendation } from "@/lib/tracking/report";

const band = (n: number | null) => (n == null ? "none" : n <= 40 ? "low" : n <= 70 ? "mid" : "high");
const toneVar = (n: number | null) =>
  n == null ? "var(--track)" : n <= 40 ? "var(--critical)" : n <= 70 ? "var(--warning)" : "var(--aqua)";

/** Ring gauge: the arc carries the score; the value sits in the centre. */
export function ScoreRing({ value, size = 150, stroke = 12, label = "/100" }: { value: number | null; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={value == null ? "No score yet" : `Score ${value} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneVar(value)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-value">
        <b>{value ?? "—"}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function MiniRing({ value }: { value: number | null }) {
  return <ScoreRing value={value} size={44} stroke={4} label="" />;
}

const byEngineOrder = <T extends { engine: string }>(rows: T[]) =>
  [...rows].sort((a, b) => ENGINE_IDS.indexOf(a.engine as never) - ENGINE_IDS.indexOf(b.engine as never));

function Bar({ value }: { value: number | null }) {
  return (
    <div className="meter thin" aria-hidden>
      <span style={{ width: `${value ?? 0}%`, background: toneVar(value) }} />
    </div>
  );
}

export function ReportHeader({ report }: { report: BrandReport }) {
  const { brand, vis } = report;
  const country = COUNTRIES.find((c) => c.iso === brand.countryIso);
  const checked = vis.latest?.run.finishedAt ?? vis.latest?.run.startedAt;
  return (
    <section className="report-head">
      <div className="card score-card">
        <ScoreRing value={report.score} />
        <p className="small muted">AEO score</p>
      </div>
      <div className="card head-info">
        <div className="head-title">
          <h1>{brand.name}</h1>
          <span className={`badge ${band(report.score)}`}>
            {report.score == null ? "Awaiting data" : report.score > 70 ? "Strong" : report.score > 40 ? "Developing" : "At risk"}
          </span>
        </div>
        <div className="chips">
          {checked && <span className="chip-lg">🗓 {checked.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>}
          <span className="chip-lg">🌐 {brand.city ? `${brand.city}, ` : ""}{country?.name ?? brand.countryIso}</span>
          <a className="chip-lg" href={`https://${brand.domain}`} target="_blank" rel="noreferrer">
            <Favicon domain={brand.domain} /> {brand.domain}
          </a>
        </div>
        {brand.category && (
          <p className="head-line">
            <b>Category:</b> {brand.category}
          </p>
        )}
        <div className="head-line engines-line">
          <b>Tracking:</b>
          {brand.engines.filter(isEngine).map((e) => (
            <span key={e} className="engine-chip">
              <EngineIcon engine={e} size={18} /> {ENGINES[e].label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function KpiRow({ report }: { report: BrandReport }) {
  const { latest, previous } = report.vis;
  const tiles = [
    { label: "Mention rate", value: latest?.mentionRate, prev: previous?.mentionRate, hint: "Answers that name you", fmt: pct },
    { label: "Citation rate", value: latest?.citationRate, prev: previous?.citationRate, hint: "Answers that cite your site", fmt: pct },
    { label: "Share of voice", value: latest?.shareOfVoice, prev: previous?.shareOfVoice, hint: "Your share of brands named", fmt: pct },
    {
      label: "Average rank",
      value: latest?.avgPosition ?? null,
      prev: null,
      hint: "Position when you're named",
      fmt: (n: number | null | undefined) => (n ? `#${n.toFixed(1)}` : "—"),
    },
  ];
  return (
    <section className="kpis">
      {tiles.map((t) => {
        const delta = t.value != null && t.prev != null ? t.value - t.prev : null;
        return (
          <div key={t.label} className="card kpi">
            <div className="kpi-label">{t.label}</div>
            <div className="kpi-value">{t.fmt(t.value ?? null)}</div>
            <div className="kpi-foot">
              {delta != null && Math.abs(delta) >= 0.005 ? (
                <span className={delta > 0 ? "up" : "down"}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100))} pts
                </span>
              ) : null}
              <span className="muted">{t.hint}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function Panels({ report, base }: { report: BrandReport; base: string }) {
  const { vis, presence } = report;
  const totalMentioned = presence.reduce((n, e) => n + e.mentioned, 0);
  const topPrompts = [...vis.prompts]
    .filter((p) => p.checks.length)
    .map((p) => ({ ...p, rate: p.checks.filter((c) => c.mentioned).length / p.checks.length }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
  const answers = vis.latest?.checks ?? 0;
  const namedIn = vis.latest ? Math.round(vis.latest.mentionRate * answers) : 0;
  const rivals = vis.competitors.filter((c) => !c.isOwn).slice(0, 4);
  const strategyAvg = report.strategy.filter((s) => s.score != null);
  const strategyScore = strategyAvg.length ? Math.round(strategyAvg.reduce((n, s) => n + (s.score ?? 0), 0) / strategyAvg.length) : null;

  return (
    <section className="panels">
      <div className="card panel">
        <div className="panel-head">
          <h2>AI presence</h2>
          <span className="count-pill">{totalMentioned}</span>
        </div>
        <div className="presence-list">
          {presence.map((e) => (
            <div key={e.engine} className="presence-row">
              <EngineIcon engine={e.engine} size={28} title={e.label} />
              <span className="presence-name">{e.label}</span>
              <span className={`dot-status ${e.mentioned ? "yes" : "no"}`} aria-label={e.mentioned ? "Mentioned" : "Not mentioned"}>
                {e.mentioned ? "✓" : "✕"}
              </span>
              <b className="num">
                {e.mentioned}/{e.prompts}
              </b>
            </div>
          ))}
          {presence.length === 0 && <p className="muted small">Choose engines in Brand settings.</p>}
        </div>
      </div>

      <div className="card panel">
        <div className="panel-head">
          <h2>Key prompts</h2>
          <span className="count-pill">{vis.prompts.length}</span>
        </div>
        <div className="stack tight">
          {topPrompts.map((p) => (
            <Link key={p.id} href={`${base}?tab=prompts`} className="prompt-mini">
              <span>{p.text}</span>
              <span className="prompt-mini-foot">
                <span className="icons">
                  {byEngineOrder(p.checks).map((c) => (
                    <span key={c.id} className={c.mentioned ? "" : "faded"}>
                      <EngineIcon engine={c.engine} size={18} />
                    </span>
                  ))}
                </span>
                <span className="pct-pill">{pct(p.rate)}</span>
              </span>
            </Link>
          ))}
          {topPrompts.length === 0 && <p className="muted small">Results appear after the first check.</p>}
        </div>
      </div>

      <div className="card panel">
        <div className="panel-head">
          <h2>Competitor landscape</h2>
          <span className="count-pill">{vis.competitors.filter((c) => !c.isOwn).length}</span>
        </div>
        <p className="panel-lede">
          You were named in <b>{namedIn}</b> of <b>{answers}</b> AI answers in the latest check.
        </p>
        <div className="rivals">
          {rivals.map((r) => (
            <div key={r.name} className="rival">
              <span>{r.name}</span>
              <b className="num">{r.mentions}×</b>
            </div>
          ))}
          {rivals.length === 0 && <span className="chip-lg">No competitors named yet</span>}
        </div>
        <Link href={`${base}?tab=competitors`} className="small">
          See all competitors →
        </Link>
      </div>

      <div className="card panel">
        <div className="panel-head">
          <h2>Strategy review</h2>
          <MiniRing value={strategyScore} />
        </div>
        <div className="strategy">
          {report.strategy.map((s) => (
            <div key={s.label} className="strategy-row" title={s.hint}>
              <div className="row-between">
                <span>{s.label}</span>
                <b className="num">{s.score ?? "—"}</b>
              </div>
              <Bar value={s.score} />
            </div>
          ))}
          <div className="strategy-row">
            <span>Web presence</span>
            <div className="presence-grid">
              {report.webPresence.slice(0, 4).map((w) => (
                <span key={w.key} className="presence-cell" title={`${w.label}: cited ${w.citations} times`}>
                  <Favicon domain={w.domain} /> <b className="num">{w.citations}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
        {!report.audit && (
          <Link href={`${base}?tab=audit`} className="small">
            Run the site audit to score these →
          </Link>
        )}
      </div>
    </section>
  );
}

function RecCard({ rec, brandId, canEdit }: { rec: Recommendation; brandId: string; canEdit: boolean }) {
  const lv = (x: string) => (x === "high" ? 3 : x === "medium" ? 2 : 1);
  return (
    <article className={`card rec ${rec.state ?? ""}`}>
      <div className="rec-top">
        <span className="pill-sm">
          <span className={`lvl b${lv(rec.impact)}`} aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {rec.impact} impact
        </span>
        <span className="pill-sm">{rec.effort} effort</span>
        <span className="pill-sm tag">{rec.tag}</span>
        <span className="pill-sm prio" title="Priority score">
          ◎ {rec.priority}
        </span>
      </div>
      <h3>{rec.title}</h3>
      <p>{rec.detail}</p>
      <div className="evidence">
        {rec.evidence.map((e) => (
          <span key={e} className="pill-sm">
            {e}
          </span>
        ))}
      </div>
      <details className="steps">
        <summary>{rec.steps.length} steps</summary>
        <ol>
          {rec.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>
      {canEdit && (
        <div className="rec-actions">
          {rec.state ? (
            <form action={setRecommendationState.bind(null, brandId, rec.id, null)}>
              <SubmitButton className="btn ghost small">{rec.state === "done" ? "✓ Completed · undo" : "Dismissed · undo"}</SubmitButton>
            </form>
          ) : (
            <>
              <form action={recommendationToTask.bind(null, brandId, { id: rec.id, title: rec.title, detail: rec.detail, steps: rec.steps, tag: rec.tag })}>
                <SubmitButton className="btn ghost small" pendingText="Adding…">
                  + Task board
                </SubmitButton>
              </form>
              <span className="spacer" />
              <form action={setRecommendationState.bind(null, brandId, rec.id, "dismissed")}>
                <SubmitButton className="btn ghost small">✕ Dismiss</SubmitButton>
              </form>
              <form action={setRecommendationState.bind(null, brandId, rec.id, "done")}>
                <SubmitButton className="btn ghost small">✓ Complete</SubmitButton>
              </form>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function Recommendations({ report, canEdit }: { report: BrandReport; canEdit: boolean }) {
  const recs = report.recommendations;
  if (!recs.length) return null;
  const done = recs.filter((r) => r.state === "done").length;
  return (
    <section className="stack">
      <div className="row-between">
        <div>
          <h2 className="section-title">Recommendations</h2>
          <p className="muted">Prioritised actions, each backed by evidence from your latest data.</p>
        </div>
        <span className="card completed-pill">
          <b>
            {done}/{recs.length}
          </b>{" "}
          completed
        </span>
      </div>
      <div className="carousel">
        {recs.map((r) => (
          <RecCard key={r.id} rec={r} brandId={report.brand.id} canEdit={canEdit} />
        ))}
      </div>
    </section>
  );
}

function strip(md: string) {
  return md.replace(/\*\*|__|#+\s|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
}

export function FullReport({ report, base }: { report: BrandReport; base: string }) {
  const { vis, brand } = report;
  const country = COUNTRIES.find((c) => c.iso === brand.countryIso)?.name ?? brand.countryIso;
  return (
    <section className="stack">
      <h2 className="section-title">Full report</h2>
      <div className="card prompt-report">
        <div className="panel-head">
          <div className="row-gap" style={{ marginTop: 0, alignItems: "center" }}>
            <MiniRing value={vis.latest ? Math.round(vis.latest.mentionRate * 100) : null} />
            <h3 style={{ margin: 0 }}>Key prompts</h3>
          </div>
          <span className="muted small">{vis.prompts.length} tracked</span>
        </div>
        {vis.prompts.map((p, i) => {
          const done = p.checks.filter((c) => c.status === "done");
          const rate = done.length ? done.filter((c) => c.mentioned).length / done.length : 0;
          const cited = done.some((c) => c.cited);
          const status = cited ? "Cited" : rate > 0 ? "Mentioned" : done.length ? "Absent" : "Pending";
          return (
            <details key={p.id} className="prompt-item" open={i === 0}>
              <summary>
                <div>
                  <div className="prompt-text">{p.text}</div>
                  <div className="prompt-meta">
                    <span className="live-dot">Active</span>
                    <span>{done.length} responses</span>
                    <span className="muted">{p.intent}</span>
                  </div>
                </div>
                <div className="prompt-right">
                  <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
                  <span className="icons">
                    {byEngineOrder(p.checks).map((c) => (
                      <span key={c.id} className={c.mentioned ? "" : "faded"}>
                        <EngineIcon engine={c.engine} size={20} />
                      </span>
                    ))}
                  </span>
                  <b className="num">{pct(rate)}</b>
                </div>
              </summary>
              <div className="responses">
                {byEngineOrder(p.checks).map((c) => {
                  const fanOut = c.fanOut ?? [];
                  return (
                    <div key={c.id} className="response">
                      <EngineIcon engine={c.engine} size={26} title={isEngine(c.engine) ? ENGINES[c.engine].label : c.engine} />
                      <div className="response-body">
                        <div className="response-top">
                          <b>{isEngine(c.engine) ? ENGINES[c.engine].label : c.engine}</b>
                          {c.mentioned ? (
                            <span className="status-badge mentioned">Named #{c.position}</span>
                          ) : c.status === "done" ? (
                            <span className="status-badge absent">Not named</span>
                          ) : (
                            <span className="status-badge pending">{c.status}</span>
                          )}
                          {c.cited && <span className="status-badge cited">Your site cited</span>}
                        </div>
                        <p className="response-text">
                          {strip(c.answer ?? c.error ?? "").slice(0, 260)}
                          {(c.answer?.length ?? 0) > 260 ? "…" : ""}{" "}
                          <Link href={`${base}/checks/${c.id}`}>Read full answer</Link>
                        </p>
                        <p className="muted small">
                          {country} · checked {(c.completedAt ?? c.createdAt).toLocaleString()}
                        </p>
                        {!!c.sources?.length && (
                          <div className="source-chips">
                            {c.sources.slice(0, 8).map((s) => (
                              <a key={s.url} href={s.url} target="_blank" rel="noreferrer nofollow" className={`source-chip ${s.domain.endsWith(brand.domain) ? "own" : ""}`}>
                                <Favicon domain={s.domain} /> {s.domain}
                              </a>
                            ))}
                          </div>
                        )}
                        {fanOut.length > 0 && (
                          <div className="fanout">
                            <span className="small muted">Query fan-outs</span>
                            <div className="source-chips">
                              {fanOut.map((q) => (
                                <span key={q} className="source-chip">
                                  {q}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {p.checks.length === 0 && <p className="muted">Not checked yet.</p>}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

const CRAWLER_ITEMS: { id: string; label: string }[] = [
  { id: "sitemap", label: "XML sitemap" },
  { id: "robots-present", label: "robots.txt" },
  { id: "ai-search-bots-allowed", label: "AI search bots allowed" },
  { id: "firewall-bot-blocking", label: "Not blocked by CDN / firewall" },
  { id: "meta-robots", label: "No noindex / nosnippet" },
  { id: "llms-txt", label: "llms.txt" },
  { id: "server-rendered", label: "Pre-rendered text (no JavaScript needed)" },
  { id: "lang", label: "Language declared" },
];

export function CrawlerChecklist({ report, base }: { report: BrandReport; base: string }) {
  const audit = report.audit;
  if (!audit) {
    return (
      <Empty title="Site readiness not checked yet">
        <p className="muted">Run the site audit to see if AI crawlers can reach and understand your pages.</p>
        <Link href={`${base}?tab=audit`} className="btn">
          Run site audit
        </Link>
      </Empty>
    );
  }
  const byId = new Map<string, CheckResult>(audit.checks.map((c) => [c.id, c]));
  const sem = audit.page.semantics;
  return (
    <section className="two-col">
      <div className="card">
        <h2>AI crawler accessibility</h2>
        <p className="muted small">Can AI crawlers reach, read and trust your pages? Checked {report.auditDate?.toLocaleDateString()}.</p>
        <div className="checklist">
          {CRAWLER_ITEMS.map((item) => {
            const c = byId.get(item.id);
            const ok = c ? c.status === "pass" || c.status === "info" : false;
            return (
              <div key={item.id} className="check-row" title={c?.detail}>
                <span>{item.label}</span>
                {item.id === "lang" && c?.detail ? (
                  <span className="muted small">{c.status === "pass" ? c.detail.replace(/[<>"]/g, "").replace("html lang=", "") : "missing"}</span>
                ) : (
                  <span className={`tick ${ok ? "ok" : c?.status === "warn" ? "warn" : "bad"}`} aria-label={ok ? "Pass" : "Needs work"}>
                    {ok ? "✓" : "✕"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h2>Semantic structure</h2>
        <p className="muted small">Semantic HTML helps models understand what each part of the page is.</p>
        {sem ? (
          <>
            <div className="tag-cloud">
              {sem.tags.map((t) => (
                <code key={t}>&lt;{t}&gt;</code>
              ))}
            </div>
            <div className="kpis three">
              <div className="stat">
                <div className="label">Tag types</div>
                <div className="value">{sem.tags.length}</div>
              </div>
              <div className="stat">
                <div className="label">Semantic elements</div>
                <div className="value">{sem.semantic}</div>
              </div>
              <div className="stat">
                <div className="label">Generic elements</div>
                <div className="value">{sem.nonSemantic}</div>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Re-run the audit to collect semantic structure.</p>
        )}
        <h3 style={{ marginTop: 18 }}>Mention rate over time</h3>
        {report.vis.trend.filter((t) => t.checks > 0).length > 1 ? (
          <TrendChart
            points={report.vis.trend
              .filter((t) => t.checks > 0)
              .map((t) => ({ label: t.run.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: t.mentionRate }))}
          />
        ) : (
          <p className="muted small">The trend appears after two checks.</p>
        )}
      </div>
    </section>
  );
}
