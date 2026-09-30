import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import {
  addCompetitor,
  addPrompts,
  ignoreBrand,
  removeCompetitor,
  removePrompt,
  runBrandAudit,
  setKeyCompetitor,
  trackSuggested,
  unignoreBrand,
  updateBrand,
  updateReportRecipients,
} from "@/app/actions/brands";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { EngineIcon, Favicon } from "@/app/components/logo";
import { Empty, Pill, ShareBars, pct } from "@/app/components/ui";
import { Report } from "@/app/report";
import type { AuditReport } from "@/lib/audit/types";
import { db } from "@/lib/db";
import { audits, brands, reportSends, runs } from "@/lib/db/schema";
import { emailConfigured } from "@/lib/email";
import { COUNTRIES } from "@/lib/locations";
import { planFor } from "@/lib/plans";
import { ENGINES, ENGINE_IDS, isEngine } from "@/lib/tracking/engines";
import type { BrandVisibility } from "@/lib/tracking/metrics";
import { sourceType, type BrandReport } from "@/lib/tracking/report";
import { sendReportNowAction } from "@/app/actions/reports";

type Vis = BrandVisibility;

function ResultCell({ r, href }: { r?: Vis["prompts"][number]["results"][keyof Vis["prompts"][number]["results"]]; href: string }) {
  if (!r) return <span className="muted">—</span>;
  if (r.status === "pending" || r.status === "processing") return <span className="muted small">checking…</span>;
  if (r.status === "error") return <Pill tone="warn">error</Pill>;
  return (
    <Link href={href} className="cell-link" title="View the full answer">
      {r.mentioned ? <Pill tone="good">#{r.position}</Pill> : <Pill tone="bad">absent</Pill>}
      {r.cited && <Pill tone="neutral">cited</Pill>}
    </Link>
  );
}

export function Prompts({
  vis,
  base,
  brandId,
  canEdit,
  engines,
}: {
  vis: Vis;
  base: string;
  brandId: string;
  canEdit: boolean;
  engines: string[];
}) {
  const cols = ENGINE_IDS.filter((e) => engines.includes(e));
  return (
    <>
      <section className="card">
        <h2>Tracked prompts</h2>
        <p className="muted small">Green shows your rank in the answer; select a result to read the full answer and its sources.</p>
        {vis.prompts.length === 0 ? (
          <p className="muted">No prompts yet. Add the questions your buyers ask below.</p>
        ) : (
          <div className="table-wrap">
            <table className="prompt-table">
              <thead>
                <tr>
                  <th>Prompt</th>
                  {cols.map((e) => (
                    <th key={e}>{ENGINES[e].label}</th>
                  ))}
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {vis.prompts.map((p) => (
                  <tr key={p.id}>
                    <td className="pt-text">
                      {p.text}
                      <div className="muted small">{p.intent}</div>
                    </td>
                    {cols.map((e) => (
                      <td key={e} className="pt-res" data-label={ENGINES[e].label}>
                        <ResultCell r={p.results[e]} href={p.results[e] ? `${base}/checks/${p.results[e]!.id}` : "#"} />
                      </td>
                    ))}
                    {canEdit && (
                      <td className="pt-rm">
                        <form action={removePrompt.bind(null, p.id)}>
                          <button className="linklike muted small nowrap" title="Stop tracking this prompt">
                            Remove
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {canEdit && (
        <section className="card">
          <h2>Add prompts</h2>
          <ActionForm action={addPrompts.bind(null, brandId)} resetOnSuccess>
            <textarea name="prompts" rows={4} placeholder="One prompt per line" required />
            <div className="field-row">
              <label>
                Type
                <select name="intent" defaultValue="auto">
                  <option value="auto">Detect automatically</option>
                  <option value="best">Best / top</option>
                  <option value="problem">Problem / how-to</option>
                  <option value="comparison">Comparison / alternative</option>
                  <option value="local">Local</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <SubmitButton>Add prompts</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}


export function Sources({ report }: { report: BrandReport }) {
  const { vis, brand } = report;
  if (!vis.sources.length) {
    return (
      <Empty title="No sources yet">
        <p className="muted">Once engines answer your prompts, the pages they cite show up here.</p>
      </Empty>
    );
  }
  const max = Math.max(...report.sourceTypes.map((t) => t.count), 1);
  return (
    <>
      <section className="two-col">
        <div className="card">
          <h2>Source types</h2>
          <p className="muted small">What kind of sites AI engines trust in your niche. Target the biggest bars first.</p>
          <div className="bars">
            {report.sourceTypes.map((t) => (
              <div className="bar-row" key={t.type} title={`${t.type}: ${t.count} citations`}>
                <span className="bar-label">
                  <span className="bar-name">{t.type}</span>
                </span>
                <span className="bar-track">
                  <span className={`bar-fill ${t.type === "Your site" ? "own" : ""}`} style={{ width: `${(t.count / max) * 100}%` }} />
                </span>
                <span className="bar-value">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Web presence</h2>
          <p className="muted small">Citations of the platforms AI engines lean on most.</p>
          <div className="presence-tiles">
            {report.webPresence.map((w) => (
              <div key={w.key} className="presence-tile">
                <Favicon domain={w.domain} size={20} />
                <span>{w.label}</span>
                <b className="num">{w.citations}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Most-cited pages and domains</h2>
        <p className="muted small">
          Getting mentioned on these (threads, listicles, directories) is the fastest way into the answers.
        </p>
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Type</th>
                <th>Answers citing it</th>
                <th>Example page</th>
              </tr>
            </thead>
            <tbody>
              {vis.sources.map((s) => (
                <tr key={s.domain}>
                  <td>
                    <span className="with-icon">
                      <Favicon domain={s.domain} /> <b>{s.domain}</b>
                    </span>{" "}
                    {s.domain.endsWith(brand.domain) && <Pill tone="good">you</Pill>}
                  </td>
                  <td className="muted" data-label="Type">{sourceType(s.domain, brand.domain)}</td>
                  <td className="num" data-label="Answers">{s.citations}</td>
                  <td className="st-wide" data-label="Example">
                    <a href={s.sample} target="_blank" rel="noreferrer nofollow">
                      {s.title || s.sample}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CompetitorCard({
  brandId,
  name,
  domain,
  mentions,
  share,
  isKey,
  canEdit,
}: {
  brandId: string;
  name: string;
  domain?: string;
  mentions: number;
  share: number;
  isKey: boolean;
  canEdit: boolean;
}) {
  return (
    <div className={`comp-card ${isKey ? "key" : ""}`}>
      <div className="comp-name">
        {domain ? <Favicon domain={domain} /> : <span className="comp-dot" aria-hidden />}
        <b title={name}>{name}</b>
      </div>
      <div className="comp-meta">
        {isKey && <span className="key-pill">Key competitor</span>}
        <span className="muted small">
          {mentions} mention{mentions === 1 ? "" : "s"} · {pct(share)}
        </span>
      </div>
      {canEdit && (
        <div className="comp-actions">
          <form action={setKeyCompetitor.bind(null, brandId, name, !isKey)}>
            <button className="linklike small">{isKey ? "Unmark key" : "Mark as key"}</button>
          </form>
          <form action={ignoreBrand.bind(null, brandId, name)}>
            <button className="linklike small muted">Ignore</button>
          </form>
          <form action={removeCompetitor.bind(null, brandId, name)}>
            <button className="linklike small muted">Remove</button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Competitors({ report, canEdit }: { report: BrandReport; canEdit: boolean }) {
  const { vis, brand } = report;
  const lower = (s: string) => s.toLowerCase();
  const tracked = new Set(brand.competitors.map((c) => lower(c.name)));
  const keys = new Set(brand.keyCompetitors.map(lower));
  const stats = new Map(vis.competitors.map((c) => [lower(c.name), c]));
  const suggestions = vis.competitors.filter((c) => !c.isOwn && !tracked.has(lower(c.name))).slice(0, 5);
  const keyList = brand.competitors.filter((c) => keys.has(lower(c.name)));
  const otherList = brand.competitors.filter((c) => !keys.has(lower(c.name)));
  const card = (c: { name: string; domain?: string }, isKey: boolean) => {
    const st = stats.get(lower(c.name));
    return (
      <CompetitorCard
        key={c.name}
        brandId={brand.id}
        name={c.name}
        domain={c.domain}
        mentions={st?.mentions ?? 0}
        share={st?.share ?? 0}
        isKey={isKey}
        canEdit={canEdit}
      />
    );
  };

  const rows = vis.competitors.map((c) => {
    const checks = vis.prompts.flatMap((p) => p.checks.filter((x) => x.brandsFound?.some((b) => b.name === c.name)));
    const engines = ENGINE_IDS.filter((e) => checks.some((x) => x.engine === e));
    const wins = vis.prompts.filter((p) => {
      const named = p.checks.some((x) => x.brandsFound?.some((b) => b.name === c.name));
      const own = p.checks.some((x) => x.mentioned);
      return named && !own;
    }).length;
    const positions = checks.map((x) => x.brandsFound!.find((b) => b.name === c.name)!.position);
    const avg = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
    return { ...c, engines, wins, avg };
  });

  return (
    <>
      <div>
        <h1>Competitors</h1>
        <p className="muted">Shape the competitor set used for share of voice, prompt mentions and source analysis.</p>
      </div>

      {canEdit && suggestions.length > 0 && (
        <section className="card nba">
          <div className="row-between">
            <h2>Next best actions</h2>
            <span className="pill-sm">{suggestions.length} to review</span>
          </div>
          {suggestions.map((sug) => (
            <div key={sug.name} className="nba-row">
              <div className="nba-text">
                <b>{sug.name}</b>
                <span className="muted small">
                  Recommended {sug.mentions} time{sug.mentions === 1 ? "" : "s"} by AI engines ({pct(sug.share)} share of voice) but not tracked.
                </span>
              </div>
              <div className="nba-actions">
                <form action={ignoreBrand.bind(null, brand.id, sug.name)}>
                  <button className="btn ghost small">Ignore</button>
                </form>
                <form action={trackSuggested.bind(null, brand.id, sug.name)}>
                  <button className="btn small dark">Track</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <div className="row-between">
          <h2>
            Key competitors <span className="muted">· {keyList.length}</span>
          </h2>
          <span className="muted small">Tracked most closely (up to 10)</span>
        </div>
        <div className="comp-grid">
          {keyList.map((c) => card(c, true))}
          {!keyList.length && <p className="muted small">Mark your biggest rivals as key competitors to follow them closely.</p>}
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>
            Competitors <span className="muted">· {otherList.length}</span>
          </h2>
          <span className="muted small">Other brands in your market</span>
        </div>
        <div className="comp-grid">
          {otherList.map((c) => card(c, false))}
          {canEdit && (
            <ActionForm action={addCompetitor.bind(null, brand.id)} className="comp-add" resetOnSuccess>
              <b>Add competitor</b>
              <input name="name" placeholder="Brand name" required />
              <input name="domain" placeholder="Website (optional)" />
              <label className="check-label small">
                <input type="checkbox" name="key" /> Key competitor
              </label>
              <SubmitButton className="btn small">Add</SubmitButton>
            </ActionForm>
          )}
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>
            Ignored <span className="muted">· {brand.ignoredBrands.length}</span>
          </h2>
          <span className="muted small">Removed from tracking and all rankings</span>
        </div>
        {brand.ignoredBrands.length ? (
          <div className="chips">
            {brand.ignoredBrands.map((n) => (
              <span key={n} className="ignored-chip">
                {n}
                {canEdit && (
                  <form action={unignoreBrand.bind(null, brand.id, n)}>
                    <button className="linklike small" aria-label={`Restore ${n}`}>
                      Restore
                    </button>
                  </form>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted small">Park false positives here (directories, generic terms) so rankings stay clean.</p>
        )}
      </section>

      {vis.competitors.length > 0 && (
        <>
          <section className="card">
            <h2>Share of voice</h2>
            <p className="muted small">Each brand&apos;s share of all brand mentions in the latest check.</p>
            <ShareBars rows={vis.competitors} />
          </section>
          <section className="card">
            <h2>Who AI recommends</h2>
            <div className="table-wrap">
              <table className="stack-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Mentions</th>
                    <th>Share</th>
                    <th>Avg rank</th>
                    <th>Engines</th>
                    <th>Prompts they win</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className={r.isOwn ? "own-row" : ""}>
                      <td>
                        <b>{r.name}</b> {r.isOwn && <span className="you">you</span>}
                        {keys.has(lower(r.name)) && <span className="key-pill">Key</span>}
                      </td>
                      <td className="num" data-label="Mentions">{r.mentions}</td>
                      <td className="num" data-label="Share">{pct(r.share)}</td>
                      <td className="num" data-label="Avg rank">{r.avg ? `#${r.avg.toFixed(1)}` : "—"}</td>
                      <td data-label="Engines">
                        <span className="icons">
                          {r.engines.filter(isEngine).map((e) => (
                            <EngineIcon key={e} engine={e} size={16} title={ENGINES[e].label} />
                          ))}
                        </span>
                      </td>
                      <td className="num" data-label="Prompts won">{r.isOwn ? "—" : r.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function monthLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function Reports({ brand, base, canEdit }: { brand: typeof brands.$inferSelect; base: string; canEdit: boolean }) {
  const runRows = await db.select({ startedAt: runs.startedAt }).from(runs).where(eq(runs.brandId, brand.id)).orderBy(desc(runs.startedAt));
  const periods = [...new Set(runRows.map((r) => r.startedAt.toISOString().slice(0, 7)))];
  const current = new Date().toISOString().slice(0, 7);
  if (!periods.includes(current)) periods.unshift(current);
  const sends = await db.select().from(reportSends).where(eq(reportSends.brandId, brand.id));
  const pdf = (p: string) => `/api/reports/${brand.id}?period=${p}`;
  return (
    <>
      <section className="card report-hero">
        <div>
          <p className="eyebrow">Monthly AI visibility report</p>
          <h2>A client-ready PDF, every month</h2>
          <p className="muted">
            Score, share of voice, engine-by-engine results, competitors, cited sources, site readiness, the work delivered and
            next month&apos;s priorities, in one branded PDF.
          </p>
          <div className="row-gap">
            <a className="btn" href={pdf(current)}>
              Download this month&apos;s PDF
            </a>
            <Link className="btn ghost" href={`${base}?tab=reports#email`}>
              Email it
            </Link>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/report-cover.svg" alt="" className="report-cover" />
      </section>
      <section className="two-col">
        <div className="card">
          <h2>Past reports</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Emailed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const sent = sends.find((s) => s.period === p);
                  return (
                    <tr key={p}>
                      <td>
                        <b>{monthLabel(p)}</b>
                        {p === current && <span className="muted small"> · so far</span>}
                      </td>
                      <td className="muted small">{sent ? `${sent.sentAt.toLocaleDateString()} to ${sent.recipients.length}` : "—"}</td>
                      <td>
                        <a className="nowrap" href={pdf(p)}>Download PDF</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="stack">
          <div className="card" id="email">
            <h2>Send now</h2>
            <p className="muted small">Email this month&apos;s PDF to a client or to yourself.</p>
            <ActionForm action={sendReportNowAction.bind(null, brand.id, current)} resetOnSuccess>
              <div className="field-row">
                <input name="email" type="email" placeholder="client@business.com" required />
                <SubmitButton pendingText="Sending…">Send report</SubmitButton>
              </div>
            </ActionForm>
            {!emailConfigured() && <p className="hint">Email isn&apos;t set up yet, so messages are logged instead of sent.</p>}
          </div>
          {canEdit && (
            <div className="card">
              <h2>Automatic monthly email</h2>
              <p className="muted small">On the 1st of each month we email last month&apos;s report to these addresses.</p>
              <ActionForm action={updateReportRecipients.bind(null, brand.id)}>
                <textarea name="recipients" rows={2} defaultValue={brand.reportRecipients.join(", ")} placeholder="owner@client.com, you@agency.com" />
                <SubmitButton>Save recipients</SubmitButton>
              </ActionForm>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export async function Audit({ brandId, canEdit }: { brandId: string; canEdit: boolean }) {
  const [latest] = await db.select().from(audits).where(eq(audits.brandId, brandId)).orderBy(desc(audits.createdAt)).limit(1);
  return (
    <>
      {canEdit && (
        <form action={runBrandAudit.bind(null, brandId)} className="row-end">
          <SubmitButton className="btn ghost" pendingText="Auditing site… (up to 30s)">
            {latest ? "Re-run audit" : "Run AEO site audit"}
          </SubmitButton>
        </form>
      )}
      {latest ? (
        <Report report={latest.report as AuditReport} />
      ) : (
        <Empty title="No audit yet">
          <p className="muted">The audit checks AI crawler access, structured data, content and trust signals.</p>
        </Empty>
      )}
    </>
  );
}

export function Settings({ brand, planId }: { brand: typeof brands.$inferSelect; planId: string }) {
  const plan = planFor(planId);
  return (
    <section className="card narrow">
      <h2>Brand settings</h2>
      <ActionForm action={updateBrand.bind(null, brand.id)}>
        <div className="field-row">
          <label>
            Brand name
            <input name="name" defaultValue={brand.name} required />
          </label>
          <label>
            Website
            <input name="domain" defaultValue={brand.domain} required />
          </label>
        </div>
        <label>
          What do you sell?
          <input name="category" defaultValue={brand.category} />
        </label>
        <div className="field-row">
          <label>
            Country
            <select name="country" defaultValue={brand.countryIso}>
              {COUNTRIES.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            <input name="city" defaultValue={brand.city ?? ""} />
          </label>
        </div>
        <label>
          Other names
          <input name="aliases" defaultValue={brand.aliases.join(", ")} />
        </label>
        <label>
          Competitors (Name | domain, one per line)
          <textarea
            name="competitors"
            rows={4}
            defaultValue={brand.competitors.map((c) => (c.domain ? `${c.name} | ${c.domain}` : c.name)).join("\n")}
          />
        </label>
        <fieldset>
          <legend>AI engines (up to {plan.engineSlots} on {plan.name})</legend>
          <div className="checks">
            {ENGINE_IDS.map((e) => (
              <label key={e} className="check-label">
                <input type="checkbox" name="engines" value={e} defaultChecked={brand.engines.includes(e)} />
                {ENGINES[e].label}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Frequency
          <select name="frequency" defaultValue={brand.frequency}>
            <option value="weekly">Weekly</option>
            <option value="daily" disabled={!plan.frequencies.includes("daily")}>
              Daily{plan.frequencies.includes("daily") ? "" : " (Growth and above)"}
            </option>
          </select>
        </label>
        <SubmitButton>Save settings</SubmitButton>
      </ActionForm>
    </section>
  );
}
