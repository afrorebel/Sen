import { Fragment, type ReactNode } from "react";
import { EngineIcon } from "@/app/components/logo";
import { defaultEngines, PLANS, type PlanId } from "@/lib/plans";

const COLS: PlanId[] = ["free", "starter", "growth", "agency", "dfy"];
const ALL_ENGINES = ["chatgpt", "google_ai_mode", "perplexity", "gemini", "claude"];
const LABEL: Record<string, string> = { chatgpt: "ChatGPT", google_ai_mode: "Google AI Mode", perplexity: "Perplexity", gemini: "Gemini", claude: "Claude" };

type Cell = boolean | string | ReactNode;
type Row = { label: string; hint?: string; cells: (id: PlanId) => Cell };

const yes = (ids: PlanId[]) => (id: PlanId) => ids.includes(id);
const ALL: PlanId[] = COLS;

function Engines({ id }: { id: PlanId }) {
  const on = new Set<string>(defaultEngines(PLANS[id]));
  const slots = PLANS[id].engineSlots;
  return (
    <span className="pm-engines-cell">
      <span className="pm-engines" title={`Choose any ${slots} of the 5 engines`}>
        {ALL_ENGINES.map((e) => (
          <span key={e} className={on.has(e) ? "" : "off"}>
            <EngineIcon engine={e} size={16} title={LABEL[e]} />
          </span>
        ))}
      </span>
      <small>{slots === 5 ? "All 5" : `Any ${slots} of 5`}</small>
    </span>
  );
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Scale",
    rows: [
      { label: "Brands", cells: (id) => String(PLANS[id].brands) },
      { label: "Tracked prompts", cells: (id) => String(PLANS[id].prompts) },
      { label: "AI engines per brand", hint: "ChatGPT, Google AI Mode, Perplexity, Gemini, Claude", cells: (id) => <Engines id={id} /> },
      { label: "Tracking frequency", cells: (id) => (PLANS[id].frequencies.includes("daily") ? "Daily or weekly" : "Weekly") },
      { label: "Site audit pages", cells: (id) => PLANS[id].auditPages.toLocaleString("en-US") },
    ],
  },
  {
    title: "Visibility",
    rows: [
      { label: "Mention, citation and rank tracking", cells: yes(ALL) },
      { label: "Share of voice vs competitors", cells: yes(ALL) },
      { label: "Cited sources and source types", cells: yes(ALL) },
      { label: "Query fan-out analysis", cells: yes(ALL) },
      { label: "AI crawler and AI referral traffic", cells: yes(ALL) },
    ],
  },
  {
    title: "Workflow",
    rows: [
      { label: "Prioritised tasks with step checklists", cells: yes(ALL) },
      { label: "Task board and team members", cells: yes(ALL) },
      { label: "Monthly PDF report", cells: yes(["starter", "growth", "agency", "dfy"]) },
      { label: "Reports emailed to clients", cells: yes(["growth", "agency", "dfy"]) },
      { label: "Client portal logins", cells: yes(["agency", "dfy"]) },
      { label: "White-label reports", cells: yes(["agency"]) },
    ],
  },
  {
    title: "Delivery",
    rows: [
      { label: "Full AEO audit and technical fixes", cells: yes(["dfy"]) },
      { label: "Schema, llms.txt and FAQ implementation", cells: yes(["dfy"]) },
      { label: "Answer-first articles", cells: (id) => (id === "dfy" ? "4 / month" : false) },
      { label: "Every task and deliverable in your portal", cells: yes(["dfy"]) },
    ],
  },
];

function Value({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="pm-yes" aria-label="Included">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  if (v === false)
    return (
      <span className="pm-no" aria-label="Not included">
        –
      </span>
    );
  return <>{v}</>;
}

export function PlanMatrix() {
  return (
    <section className="plan-matrix" aria-labelledby="pm-title">
      <div className="section-head">
        <h2 id="pm-title">Compare plans</h2>
        <p className="muted">Every plan includes the full dashboard. Higher plans add scale, client workflows and hands-on delivery.</p>
      </div>
      <div className="pm-pick" role="radiogroup" aria-label="Plan to show">
        {COLS.map((id) => (
          <label key={id}>
            <input type="radio" name="pm-plan" value={id} defaultChecked={id === "growth"} />
            <span>{PLANS[id].name}</span>
          </label>
        ))}
      </div>
      <div className="pm-scroll">
        <table className="pm-table">
          <thead>
            <tr>
              <th scope="col" className="pm-feature">
                <span className="sr-only">Feature</span>
              </th>
              {COLS.map((id) => (
                <th key={id} scope="col" data-col={id} className={PLANS[id].highlight ? "hl" : ""}>
                  <span className="pm-name">{PLANS[id].name}</span>
                  <span className="pm-price">
                    {id === "dfy" ? "from " : ""}${PLANS[id].monthly}
                    <small>/mo</small>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <Fragment key={g.title}>
                <tr className="pm-group">
                  <th scope="colgroup" colSpan={COLS.length + 1}>
                    {g.title}
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="pm-feature" title={r.hint}>
                      {r.label}
                    </th>
                    {COLS.map((id) => (
                      <td key={id} data-col={id} className={PLANS[id].highlight ? "hl" : ""}>
                        <Value v={r.cells(id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
