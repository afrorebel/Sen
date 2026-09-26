"use client";

import { useState } from "react";
import type { AuditReport, CategoryId, CheckResult, Status } from "@/lib/audit/types";

const STATUS_LABEL: Record<Status, [string, string]> = {
  pass: ["✓", "Pass"],
  warn: ["!", "Improve"],
  fail: ["✕", "Fail"],
  info: ["i", "Info"],
};

function StatusBadge({ status }: { status: Status }) {
  const [icon, label] = STATUS_LABEL[status];
  return (
    <span className={`status ${status}`}>
      <i aria-hidden>{icon}</i>
      {label}
    </span>
  );
}

function scoreColor(score: number) {
  return score <= 40 ? "var(--critical)" : score <= 70 ? "var(--warning)" : "var(--good)";
}

const BAND_LABEL = { low: "Low readiness", moderate: "Moderate readiness", high: "High readiness" };
const pct = (n: number) => `${Math.round(n * 100)}%`;

function CheckRow({ c }: { c: CheckResult }) {
  return (
    <div className="check">
      <div>
        <StatusBadge status={c.status} />
      </div>
      <div>
        <h4>{c.title}</h4>
        <p>{c.detail}</p>
        {c.evidence && c.evidence.length > 0 && c.status !== "pass" && (
          <code>{c.evidence.slice(0, 4).join(" · ")}</code>
        )}
        {c.recommendation && <p className="rec">{c.recommendation}</p>}
        {c.recommendation && (
          <div className="tags">
            <span className="tag">{c.impact} impact</span>
            <span className="tag">{c.effort} effort</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Report({ report }: { report: AuditReport }) {
  const [tab, setTab] = useState<CategoryId | "all">("all");
  const v = report.visibility;
  const shown = report.checks.filter((c) => tab === "all" || c.category === tab);

  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aeo-audit-${report.domain}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function jump(id: CategoryId) {
    setTab(id);
    document.getElementById("checks")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="report">
      <div className="toolbar no-print">
        <span className="meta">
          Audited {new Date(report.auditedAt).toLocaleString()} · {(report.durationMs / 1000).toFixed(1)}s
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={() => window.print()}>Save as PDF</button>
          <button className="btn ghost" onClick={download}>Export JSON</button>
        </span>
      </div>

      <section className="card summary">
        <div className="score-hero">
          <div className="num">{report.overall}</div>
          <div className="of">AEO / GEO score out of 100</div>
          <div className="meter" style={{ marginTop: 14 }} aria-hidden>
            <span style={{ width: `${report.overall}%`, background: scoreColor(report.overall) }} />
          </div>
          <div className={`band ${report.band}`}>{BAND_LABEL[report.band]}</div>
        </div>
        <div className="site">
          <h3>{report.brand}</h3>
          <div className="url">{report.finalUrl}</div>
          <p style={{ color: "var(--ink-2)", margin: "10px 0 0" }}>
            {report.band === "high"
              ? "Your site is well positioned to be understood and cited by AI answer engines. Work through the remaining items to lock in your advantage."
              : report.band === "moderate"
                ? "Some AI-readiness signals are in place, but gaps are limiting how often answer engines can find, trust and cite you."
                : "Significant blockers are keeping AI answer engines from reading, trusting or citing this site. Start with the quick wins below."}
          </p>
          <div className="facts">
            <span><b>{report.page.wordCount.toLocaleString()}</b> words</span>
            <span><b>{report.page.responseMs}</b> ms response</span>
            <span><b>{report.page.schemaTypes.length}</b> schema types</span>
            <span><b>{report.checks.filter((c) => c.status === "pass").length}</b>/{report.checks.length} checks passed</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Score breakdown</h2>
        <p className="sub">Weighted by how much each area affects whether AI engines cite you. Select a category to see its checks.</p>
        <div className="cats">
          {report.categories.map((c) => (
            <button key={c.id} className="cat" onClick={() => jump(c.id)}>
              <div className="row">
                <span className="name">{c.label}</span>
                <span className="val">{c.score}</span>
              </div>
              <div className="desc">{c.description}</div>
              <div className="meter" role="meter" aria-valuenow={c.score} aria-valuemin={0} aria-valuemax={100} aria-label={c.label}>
                <span style={{ width: `${c.score}%`, background: scoreColor(c.score) }} />
              </div>
              <div className="count">
                {c.passed}/{c.total} checks passed · weight {c.weight}%
              </div>
            </button>
          ))}
        </div>
      </section>

      {report.quickWins.length > 0 && (
        <section className="card">
          <h2>Top quick wins</h2>
          <p className="sub">High-impact fixes you can ship this week.</p>
          <div className="wins">
            {report.quickWins.map((c) => (
              <div className="win" key={c.id}>
                <div>
                  <h4>{c.title}</h4>
                  <p>{c.recommendation}</p>
                  <div className="tags">
                    <span className="tag">{c.impact} impact</span>
                    <span className="tag">{c.effort} effort</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {v && (
        <section className="card">
          <h2>AI visibility</h2>
          <p className="sub">
            We asked {v.engine} ({v.model}) {v.prompts.length} questions a prospective customer might ask, and checked
            whether {report.brand} was recommended or cited.
          </p>
          {v.error ? (
            <div className="notice">The visibility test could not run: {v.error}</div>
          ) : (
            <>
              <div className="stats">
                <div className="stat">
                  <div className="label">Mention rate</div>
                  <div className="value">{pct(v.mentionRate)}</div>
                </div>
                <div className="stat">
                  <div className="label">Cited as a source</div>
                  <div className="value">{pct(v.citationRate)}</div>
                </div>
                <div className="stat">
                  <div className="label">Share of voice</div>
                  <div className="value">{pct(v.shareOfVoice)}</div>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Buyer question</th>
                      <th>Mentioned</th>
                      <th>Rank</th>
                      <th>Cited</th>
                      <th>Recommended instead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.prompts.map((p) => (
                      <tr key={p.prompt}>
                        <td>
                          {p.prompt}
                          {p.excerpt && <div className="excerpt">“{p.excerpt}”</div>}
                        </td>
                        <td><StatusBadge status={p.mentioned ? "pass" : "fail"} /></td>
                        <td className="num">{p.position ? `#${p.position}` : "—"}</td>
                        <td><StatusBadge status={p.cited ? "pass" : "fail"} /></td>
                        <td>
                          <div className="chips">
                            {p.competitors.slice(0, 5).map((c) => (
                              <span className="chip" key={c}>{c}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {v.topCompetitors.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, margin: "20px 0 8px" }}>Most-recommended alternatives</h3>
                  <div className="chips">
                    {v.topCompetitors.map((c) => (
                      <span className="chip" key={c.name}>
                        {c.name} · {c.mentions}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>AI crawler access</h2>
        <p className="sub">What your robots.txt tells each AI bot about this page.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bot</th>
                <th>Used for</th>
                <th>Type</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {report.crawlers.map((c) => (
                <tr key={c.bot}>
                  <td><b>{c.bot}</b></td>
                  <td>{c.owner}</td>
                  <td>{c.purpose === "user-fetch" ? "Live browsing" : c.purpose === "search" ? "Search index" : "Training"}</td>
                  <td>
                    <StatusBadge status={c.allowed ? "pass" : c.purpose === "training" ? "warn" : "fail"} />
                    {c.rule && !c.allowed && <div className="excerpt">{c.rule}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Prioritised action plan</h2>
        <p className="sub">Every open issue, ranked by impact relative to effort.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Action</th>
                <th>Impact</th>
                <th>Effort</th>
              </tr>
            </thead>
            <tbody>
              {report.actionPlan.map((c, i) => (
                <tr key={c.id}>
                  <td className="num">{i + 1}</td>
                  <td>
                    <b>{c.title}</b>
                    <div style={{ color: "var(--ink-2)" }}>{c.recommendation}</div>
                  </td>
                  <td>{c.impact}</td>
                  <td>{c.effort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" id="checks">
        <h2>All checks</h2>
        <p className="sub">{report.checks.length} signals evaluated.</p>
        <div className="tabs no-print">
          <button className="tab" aria-pressed={tab === "all"} onClick={() => setTab("all")}>All</button>
          {report.categories.map((c) => (
            <button key={c.id} className="tab" aria-pressed={tab === c.id} onClick={() => setTab(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        {shown.map((c) => (
          <CheckRow key={c.id} c={c} />
        ))}
      </section>
    </div>
  );
}
