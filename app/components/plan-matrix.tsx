import { Fragment, type ReactNode } from "react";
import { EngineIcon } from "@/app/components/logo";
import { defaultEngines, perMonthYearly, PLANS, type Feature, type PlanId } from "@/lib/plans";

const COLS: PlanId[] = ["free", "pro", "agency", "dfy"];
const ALL_ENGINES = ["chatgpt", "google_ai_mode", "perplexity", "gemini", "claude"];
const LABEL: Record<string, string> = { chatgpt: "ChatGPT", google_ai_mode: "Google AI Mode", perplexity: "Perplexity", gemini: "Gemini", claude: "Claude" };

type Cell = boolean | string | ReactNode;
type Row = { label: string; hint?: string; cells: (id: PlanId) => Cell };

const yes = (ids: PlanId[]) => (id: PlanId) => ids.includes(id);
const ALL: PlanId[] = COLS;
const has = (f: Feature) => (id: PlanId) => PLANS[id].features.includes(f);
const FREQ: Record<string, string> = { monthly: "Monthly", weekly: "Weekly", daily: "Daily" };

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
      { label: "Brands", cells: (id) => (id === "dfy" ? "Custom" : String(PLANS[id].brands)) },
      { label: "Tracked prompts", cells: (id) => (id === "dfy" ? "Custom" : String(PLANS[id].prompts)) },
      { label: "AI engines per brand", hint: "ChatGPT, Google AI Mode, Perplexity, Gemini, Claude", cells: (id) => <Engines id={id} /> },
      { label: "Tracking frequency", cells: (id) => PLANS[id].frequencies.map((f) => FREQ[f]).join(" or ") },
      { label: "On-demand re-checks", hint: "Extra runs per month on top of the schedule", cells: (id) => (PLANS[id].manualRuns ? `${PLANS[id].manualRuns} / month` : false) },
      { label: "Team seats", cells: (id) => (PLANS[id].seats === null ? "Unlimited" : String(PLANS[id].seats)) },
    ],
  },
  {
    title: "Visibility",
    rows: [
      { label: "AEO score, mention and citation rates", cells: yes(ALL) },
      { label: "Full AI answers and query fan-outs", cells: yes(ALL) },
      { label: "AEO site audit", cells: yes(ALL) },
      { label: "Competitors and share of voice", cells: has("competitors") },
      { label: "Cited sources and source types", cells: has("sources") },
      { label: "AI crawler and AI referral traffic", cells: has("traffic") },
    ],
  },
  {
    title: "Workflow",
    rows: [
      { label: "Prioritised tasks", cells: (id) => (has("tasks")(id) ? "All, with steps" : "Top 3") },
      { label: "Task board", cells: yes(ALL) },
      { label: "Monthly PDF report, emailed automatically", cells: has("reports") },
      { label: "Client portal logins", cells: has("clientPortal") },
      { label: "White-label reports (your name and logo)", cells: (id) => id === "agency" },
    ],
  },
  {
    title: "Delivery",
    rows: [
      { label: "Strategy call and custom plan", cells: yes(["dfy"]) },
      { label: "Technical fixes, schema and llms.txt", cells: yes(["dfy"]) },
      { label: "Answer-first articles every month", cells: yes(["dfy"]) },
      { label: "Citation and listing outreach", cells: yes(["dfy"]) },
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

export function PlanMatrix({ yearly = false, booking }: { yearly?: boolean; booking: string }) {
  return (
    <section className="plan-matrix" aria-labelledby="pm-title">
      <div className="section-head">
        <h2 id="pm-title">Compare plans</h2>
        <p className="muted">Start free, upgrade to Pro for the full toolkit, or Agency to serve clients under your own brand.</p>
      </div>
      <div className="pm-pick" role="radiogroup" aria-label="Plan to show">
        {COLS.map((id) => (
          <label key={id}>
            <input type="radio" name="pm-plan" value={id} defaultChecked={id === "pro"} />
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
                  {id === "dfy" ? (
                    <a className="pm-price pm-quote" href={booking} target={booking.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                      Book a call
                    </a>
                  ) : (
                    <span className="pm-price">
                      ${yearly ? perMonthYearly(PLANS[id]) : PLANS[id].monthly}
                      <small>/mo</small>
                    </span>
                  )}
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
