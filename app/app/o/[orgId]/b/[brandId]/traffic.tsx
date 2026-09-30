import Link from "next/link";
import { enableLogDrain, rotateTrafficToken, uploadLogs } from "@/app/actions/traffic";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import type { Brand } from "@/lib/db/schema";
import { trafficSummary } from "@/lib/traffic";
import { appUrl } from "@/lib/url";

const RANGES = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "1m", label: "1 month", days: 30 },
  { id: "3m", label: "3 months", days: 90 },
];

const fmt = (n: number) => n.toLocaleString("en-US");
const PURPOSE: Record<string, string> = { search: "AI search", user: "User fetch", training: "Training" };

function Bars({ rows }: { rows: { day: string; crawler: number; referral: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.crawler + r.referral));
  const step = Math.ceil(rows.length / 7);
  return (
    <div className="tr-chart" role="img" aria-label="Daily AI crawler hits and AI-referred visits">
      <div className="tr-bars">
        {rows.map((r) => (
          <div key={r.day} className="tr-col" title={`${r.day}: ${r.crawler} crawler hits, ${r.referral} AI visits`}>
            <span className="tr-ref" style={{ height: `${(r.referral / max) * 100}%` }} />
            <span className="tr-bot" style={{ height: `${(r.crawler / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="tr-axis" aria-hidden>
        {rows.map((r, i) => (
          <span key={r.day}>{i % step === 0 ? new Date(`${r.day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : ""}</span>
        ))}
      </div>
      <div className="tr-legend">
        <span>
          <i className="tr-bot" /> AI crawler hits
        </span>
        <span>
          <i className="tr-ref" /> AI-referred visits
        </span>
      </div>
    </div>
  );
}

export async function Traffic({ brand, base, range, canEdit }: { brand: Brand; base: string; range?: string; canEdit: boolean }) {
  const r = RANGES.find((x) => x.id === range) ?? RANGES[1];
  const s = await trafficSummary(brand.id, r.days);
  const origin = await appUrl();
  const token = brand.trafficToken;
  const hasCrawl = s.crawlerHits > 0;
  const hasRefs = s.referralVisits > 0;
  const snippet = token ? `<script defer src="${origin}/t.js" data-t="${token}"></script>` : "";
  const drain = brand.trafficDrainToken ? `${origin}/api/traffic/logs?t=${brand.trafficDrainToken}` : "";

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>AI Traffic</h1>
          <p className="muted">How often AI crawlers read {brand.domain}, and how many visitors AI assistants send you.</p>
        </div>
        <nav className="seg-tabs" aria-label="Date range">
          {RANGES.map((x) => (
            <Link key={x.id} href={`${base}?tab=traffic&range=${x.id}`} aria-current={x.id === r.id ? "page" : undefined}>
              {x.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="tr-connect">
        <article className="card tr-src">
          <div className="tr-src-head">
            <span className="tr-ico" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
              </svg>
            </span>
            <div>
              <h3>AI-referred visitors</h3>
              <p className="muted small">Counts visits that arrive from ChatGPT, Perplexity, Gemini, Claude and Copilot.</p>
            </div>
            <span className={`conn-pill ${hasRefs ? "on" : token ? "wait" : ""}`}>{hasRefs ? "Receiving" : token ? "Waiting" : "Not set up"}</span>
          </div>
          {token ? (
            <>
              <p className="small">
                Paste this line before <code>&lt;/head&gt;</code> on every page. It sets no cookies and stores no personal data.
              </p>
              <pre className="code-line" tabIndex={0}>
                {snippet}
              </pre>
            </>
          ) : canEdit ? (
            <form action={rotateTrafficToken.bind(null, brand.id)}>
              <SubmitButton className="btn small" pendingText="Creating…">
                Get tracking snippet
              </SubmitButton>
            </form>
          ) : (
            <p className="muted small">Ask a workspace editor to set this up.</p>
          )}
        </article>

        <article className="card tr-src">
          <div className="tr-src-head">
            <span className="tr-ico" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </span>
            <div>
              <h3>AI crawler logs</h3>
              <p className="muted small">Detects GPTBot, ClaudeBot, PerplexityBot and {`20+`} other AI crawlers in your server logs.</p>
            </div>
            <span className={`conn-pill ${hasCrawl ? "on" : token ? "wait" : ""}`}>{hasCrawl ? "Receiving" : token ? "Waiting" : "Not set up"}</span>
          </div>
          {drain && (
            <>
              <p className="small">Log drain: point your host&apos;s log drain (Vercel, Cloudflare, Netlify) at this private URL. Keep it secret.</p>
              <pre className="code-line" tabIndex={0}>
                {drain}
              </pre>
            </>
          )}
          {canEdit && (
            <ActionForm action={uploadLogs.bind(null, brand.id)} className="tr-upload">
              <span className="small muted">Or upload an access log (.log, .txt or .json, up to 20 MB).</span>
              <div className="tr-upload-row">
                <input type="file" name="file" accept=".log,.txt,.json,.jsonl,text/plain,application/json" required aria-label="Log file" />
                <SubmitButton className="btn ghost small" pendingText="Reading…">
                  Upload logs
                </SubmitButton>
              </div>
            </ActionForm>
          )}
          {!drain && canEdit && (
            <form action={enableLogDrain.bind(null, brand.id)}>
              <SubmitButton className="linklike small" pendingText="Creating…">
                Create a log drain URL
              </SubmitButton>
            </form>
          )}
        </article>
      </section>

      <section className="kpis">
        <div className="card kpi">
          <div className="kpi-label">AI crawler hits</div>
          <div className="kpi-value">{fmt(s.crawlerHits)}</div>
          <div className="kpi-foot">
            <span className="muted">Last {r.label}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Crawler errors</div>
          <div className="kpi-value">{s.crawlerHits ? `${Math.round((s.crawlerErrors / s.crawlerHits) * 100)}%` : "—"}</div>
          <div className="kpi-foot">
            <span className="muted">{fmt(s.crawlerErrors)} requests got 4xx/5xx</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">AI-referred visits</div>
          <div className="kpi-value">{fmt(s.referralVisits)}</div>
          <div className="kpi-foot">
            <span className="muted">From {s.assistants.length} assistant{s.assistants.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Active crawlers</div>
          <div className="kpi-value">{s.crawlers.length}</div>
          <div className="kpi-foot">
            <span className="muted">Distinct AI bots seen</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Daily activity</h2>
          <span className="muted small">UTC days</span>
        </div>
        {hasCrawl || hasRefs ? <Bars rows={s.byDay} /> : <p className="muted small">No AI traffic recorded in this period yet. Connect a source above.</p>}
      </section>

      <div className="tr-grid">
        <section className="card">
          <h2>AI crawlers</h2>
          {s.crawlers.length ? (
            <div className="table-wrap">
              <table className="tr-table">
                <thead>
                  <tr>
                    <th>Crawler</th>
                    <th className="tr-type">Type</th>
                    <th className="num">Hits</th>
                    <th className="num">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {s.crawlers.map((c) => (
                    <tr key={c.name}>
                      <td>
                        <b>{c.name}</b>
                        <span className="tr-owner muted small">{c.owner}</span>
                      </td>
                      <td className="tr-type">
                        <span className={`pill-sm purpose ${c.purpose}`}>{PURPOSE[c.purpose] ?? c.purpose}</span>
                      </td>
                      <td className="num">{fmt(c.hits)}</td>
                      <td className={`num ${c.errors ? "bad-text" : ""}`}>{fmt(c.errors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small">No crawler requests yet.</p>
          )}
        </section>

        <section className="card">
          <h2>Assistants sending visitors</h2>
          {s.assistants.length ? (
            <ul className="tr-list">
              {s.assistants.map((a) => (
                <li key={a.name}>
                  <span>{a.name}</span>
                  <span className="tr-meter" aria-hidden>
                    <span style={{ width: `${(a.visits / s.assistants[0].visits) * 100}%` }} />
                  </span>
                  <b>{fmt(a.visits)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No AI-referred visits yet.</p>
          )}
        </section>

        <section className="card">
          <h2>Pages AI crawlers read most</h2>
          {s.pages.length ? (
            <ul className="tr-list paths">
              {s.pages.map((p) => (
                <li key={p.path}>
                  <code title={p.path}>{p.path}</code>
                  <span className="muted small">{p.bots} bot{p.bots === 1 ? "" : "s"}</span>
                  <b>{fmt(p.hits)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Upload logs to see which pages AI crawlers read.</p>
          )}
        </section>

        <section className="card">
          <h2>Landing pages from AI</h2>
          {s.landing.length ? (
            <ul className="tr-list paths">
              {s.landing.map((p) => (
                <li key={p.path}>
                  <code title={p.path}>{p.path}</code>
                  <span />
                  <b>{fmt(p.visits)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Add the snippet to see where AI visitors land.</p>
          )}
        </section>
      </div>

      {token && canEdit && (
        <form action={rotateTrafficToken.bind(null, brand.id)} className="muted small">
          Drain URL leaked? <SubmitButton className="linklike" pendingText="Rotating…">Rotate both keys</SubmitButton> (then update the snippet and the drain).
        </form>
      )}
    </div>
  );
}
