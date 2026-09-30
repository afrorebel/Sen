import Link from "next/link";
import { recommendationToTask, setRecommendationState, toggleRecStep } from "@/app/actions/brands";
import { AutoSubmitForm } from "@/app/components/auto-submit";
import { SubmitButton } from "@/app/components/forms";
import { Empty } from "@/app/components/ui";
import type { BrandReport, Recommendation } from "@/lib/tracking/report";

export interface TaskFilters {
  status?: string;
  q?: string;
  cat?: string;
  sort?: string;
}

const STATUSES = [
  { id: "active", label: "Active" },
  { id: "saved", label: "Saved" },
  { id: "done", label: "Completed" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const level = (x: string) => (x === "high" ? 3 : x === "medium" ? 2 : 1);

function Level({ value, label }: { value: string; label?: string }) {
  return (
    <span className="lvl-pill" title={label}>
      <span className={`lvl b${level(value)}`} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {value[0].toUpperCase() + value.slice(1)}
    </span>
  );
}

function matches(r: Recommendation, status: string) {
  if (status === "all") return true;
  if (status === "active") return r.state !== "done" && r.state !== "dismissed";
  return r.state === status;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const SAVE = "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z";
const X = "M18 6 6 18M6 6l12 12";
const CHECK = "M20 6 9 17l-5-5";
const UNDO = "M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8";

function Actions({ rec, brandId, compact }: { rec: Recommendation; brandId: string; compact?: boolean }) {
  const closed = rec.state === "done" || rec.state === "dismissed";
  if (closed) {
    return (
      <form action={setRecommendationState.bind(null, brandId, rec.id, null)}>
        <SubmitButton className="icon-btn wide" pendingText="…">
          <Icon d={UNDO} /> {rec.state === "done" ? "Reopen" : "Restore"}
        </SubmitButton>
      </form>
    );
  }
  return (
    <div className="task-btns">
      <form action={setRecommendationState.bind(null, brandId, rec.id, rec.state === "saved" ? null : "saved")}>
        <button className={`icon-btn ${rec.state === "saved" ? "on" : ""}`} title={rec.state === "saved" ? "Unsave" : "Save for later"} aria-label="Save">
          <Icon d={SAVE} />
        </button>
      </form>
      {!compact && (
        <form action={recommendationToTask.bind(null, brandId, { id: rec.id, title: rec.title, detail: rec.detail, steps: rec.steps, tag: rec.tag })}>
          <button className="icon-btn" title="Add to the task board" aria-label="Add to task board">
            <Icon d="M12 5v14M5 12h14" />
          </button>
        </form>
      )}
      <form action={setRecommendationState.bind(null, brandId, rec.id, "dismissed")}>
        <button className="icon-btn bad" title="Dismiss" aria-label="Dismiss">
          <Icon d={X} />
          {compact && <span>Dismiss</span>}
        </button>
      </form>
      <form action={setRecommendationState.bind(null, brandId, rec.id, "done")}>
        <button className="icon-btn good" title="Mark complete" aria-label="Complete">
          <Icon d={CHECK} />
          {compact && <span>Complete</span>}
        </button>
      </form>
    </div>
  );
}

function StepList({ rec, brandId, canEdit }: { rec: Recommendation; brandId: string; canEdit: boolean }) {
  const done = new Set(rec.stepsDone);
  return (
    <details className="task-steps">
      <summary>
        <span className="steps-bar" aria-hidden>
          <span style={{ width: `${(done.size / rec.steps.length) * 100}%` }} />
        </span>
        {done.size}/{rec.steps.length} steps
      </summary>
      <ol>
        {rec.steps.map((s, i) => (
          <li key={i} className={done.has(i) ? "done" : ""}>
            {canEdit ? (
              <form action={toggleRecStep.bind(null, brandId, rec.id, i)}>
                <button className="step-check" aria-pressed={done.has(i)} aria-label={done.has(i) ? "Mark step not done" : "Mark step done"}>
                  {done.has(i) ? "✓" : ""}
                </button>
              </form>
            ) : (
              <span className="step-check static">{done.has(i) ? "✓" : ""}</span>
            )}
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function Tasks({ report, base, filters, canEdit }: { report: BrandReport; base: string; filters: TaskFilters; canEdit: boolean }) {
  const all = report.recommendations;
  const status = STATUSES.some((s) => s.id === filters.status) ? filters.status! : "active";
  const q = (filters.q ?? "").trim().toLowerCase();
  const cats = [...new Set(all.map((r) => r.category))].sort();
  const cat = cats.includes(filters.cat ?? "") ? filters.cat! : "";
  const sort = filters.sort === "impact" || filters.sort === "effort" ? filters.sort : "opportunity";

  const shown = all
    .filter((r) => matches(r, status))
    .filter((r) => !cat || r.category === cat)
    .filter((r) => !q || `${r.title} ${r.detail} ${r.tag} ${r.type}`.toLowerCase().includes(q))
    .sort((a, b) =>
      sort === "impact"
        ? level(b.impact) - level(a.impact) || b.priority - a.priority
        : sort === "effort"
          ? level(a.effort) - level(b.effort) || b.priority - a.priority
          : b.priority - a.priority,
    );
  const completed = all.filter((r) => r.state === "done").length;
  const pctDone = all.length ? Math.round((completed / all.length) * 100) : 0;
  const top = all.filter((r) => matches(r, "active")).slice(0, 3);
  const link = (st: string) => {
    const p = new URLSearchParams({ tab: "tasks", status: st });
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (sort !== "opportunity") p.set("sort", sort);
    return `${base}?${p}`;
  };

  if (!all.length) {
    return (
      <Empty title="No tasks yet">
        <p className="muted">Tasks are generated from your AI answers, cited sources and site audit. Run a check and an audit to get started.</p>
      </Empty>
    );
  }

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>Tasks</h1>
          <p className="muted">Prioritised actions from your visibility, citation and site-audit evidence.</p>
        </div>
        {report.vis.latest && (
          <span className="muted small">Updated {(report.vis.latest.run.finishedAt ?? report.vis.latest.run.startedAt).toLocaleString()}</span>
        )}
      </div>

      <div className="task-toolbar">
        <nav className="seg-tabs" aria-label="Task status">
          {STATUSES.map((s) => (
            <Link key={s.id} href={link(s.id)} aria-current={status === s.id ? "page" : undefined}>
              {s.label} <b>{all.filter((r) => matches(r, s.id)).length}</b>
            </Link>
          ))}
        </nav>
        <AutoSubmitForm className="task-filters">
          <input type="hidden" name="tab" value="tasks" />
          <input type="hidden" name="status" value={status} />
          <input type="search" name="q" defaultValue={q} placeholder="Search tasks…" aria-label="Search tasks" />
          <select name="cat" defaultValue={cat} aria-label="Category">
            <option value="">All categories ({cats.length})</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} aria-label="Sort">
            <option value="opportunity">Sort: Opportunity</option>
            <option value="impact">Sort: Impact</option>
            <option value="effort">Sort: Lowest effort</option>
          </select>
        </AutoSubmitForm>
      </div>

      <div className="task-progress">
        <span className="steps-bar big" aria-hidden>
          <span style={{ width: `${pctDone}%` }} />
        </span>
        <b>{pctDone}%</b>
        <span className="muted">
          · {completed} of {all.length} tasks completed
        </span>
      </div>

      {status === "active" && top.length > 0 && !q && !cat && (
        <section className="stack">
          <h2 className="section-title">Top opportunities</h2>
          <div className="top-grid">
            {top.map((r) => (
              <article key={r.id} className="card opp">
                <div className="rec-top">
                  <Level value={r.impact} label="Impact" />
                  <Level value={r.effort} label="Effort" />
                  <span className="pill-sm prio" title="Opportunity score">
                    ◎ {r.priority}
                  </span>
                </div>
                <h3>{r.title}</h3>
                <p>{r.detail}</p>
                <div className="evidence">
                  <span className="pill-sm tag">{r.type}</span>
                  {r.evidence.slice(0, 2).map((e) => (
                    <span key={e} className="pill-sm">
                      {e}
                    </span>
                  ))}
                </div>
                <StepList rec={r} brandId={report.brand.id} canEdit={canEdit} />
                {canEdit && <Actions rec={r} brandId={report.brand.id} compact />}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <h2 className="section-title">Task table</h2>
        {shown.length === 0 ? (
          <Empty title="Nothing here">
            <p className="muted">No tasks match these filters.</p>
          </Empty>
        ) : (
          <div className="card task-table">
            <div className="tt-head" aria-hidden>
              <span>Description</span>
              <span>Opportunity</span>
              <span>Impact</span>
              <span>Effort</span>
              <span>Category</span>
              <span>Actions</span>
            </div>
            {shown.map((r) => (
              <div key={r.id} className={`tt-row ${r.state ?? ""}`}>
                <div className="tt-desc">
                  <b>{r.title}</b>
                  <p>{r.detail}</p>
                  <div className="evidence">
                    {r.evidence.slice(0, 3).map((e) => (
                      <span key={e} className="pill-sm">
                        {e}
                      </span>
                    ))}
                  </div>
                  <StepList rec={r} brandId={report.brand.id} canEdit={canEdit} />
                </div>
                <div className="tt-cell" data-label="Opportunity">
                  <span className="pill-sm prio">◎ {r.priority}</span>
                </div>
                <div className="tt-cell" data-label="Impact">
                  <Level value={r.impact} />
                </div>
                <div className="tt-cell" data-label="Effort">
                  <Level value={r.effort} />
                </div>
                <div className="tt-cell tt-cat" data-label="Category">
                  <span className={`cat-badge ${r.category.toLowerCase()}`}>{r.category}</span>
                  <span className="pill-sm" title={r.type}>
                    {r.type}
                  </span>
                </div>
                <div className="tt-cell" data-label="Actions">
                  {canEdit ? <Actions rec={r} brandId={report.brand.id} /> : <span className="muted small">{r.state ?? "open"}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
