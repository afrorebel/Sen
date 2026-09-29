import Link from "next/link";

/**
 * "What you'd pay elsewhere" comparison. Competitor figures are from their public pricing pages
 * (September 2026); keep AS_OF and the rows current when prices change.
 */
const AS_OF = "September 2026";

const COLUMNS = [
  { name: "AEO GrowthLead", sub: "Starter", price: 49, prompts: 50, engines: "Any 3 of 5", audit: true, pdf: true, dfy: "From $799/mo", us: true },
  { name: "Semrush", sub: "AI Visibility toolkit", price: 99, prompts: 25, engines: "ChatGPT, Gemini, Google AI", audit: true, pdf: false, dfy: "No" },
  { name: "Semrush One", sub: "Starter", price: 199, prompts: 50, engines: "ChatGPT, Gemini, Google AI", audit: true, pdf: false, dfy: "No" },
  { name: "Otterly", sub: "Standard", price: 189, prompts: 100, engines: "4 platforms", audit: true, pdf: false, dfy: "No" },
  { name: "AEO agency", sub: "Retainer", price: 2500, prompts: 50, engines: "Varies", audit: true, pdf: true, dfy: "Included", agency: true },
];

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function PriceCompare() {
  const ours = COLUMNS[0];
  return (
    <section className="compare" id="compare">
      <div className="compare-head">
        <p className="eyebrow">Price comparison</p>
        <h2>The same AI visibility data, for a fraction of the price</h2>
        <p className="lede">
          Most tools charge $99 to $199 a month to track 25 to 50 prompts. Agencies charge $2,500 or more. Here is what tracking
          buyer prompts actually costs.
        </p>
      </div>

      <div className="compare-cards">
        {COLUMNS.map((c) => {
          const perPrompt = c.price / c.prompts;
          return (
            <div key={c.name + c.sub} className={`compare-card ${c.us ? "us" : ""}`}>
              {c.us && <span className="ribbon">Best value</span>}
              <div className="compare-name">{c.name}</div>
              <div className="compare-sub">{c.sub}</div>
              <div className="compare-price">
                {money(c.price)}
                <span>{c.agency ? "+/mo" : "/mo"}</span>
              </div>
              <div className="compare-per">
                <b>{money(Math.round(perPrompt * 100) / 100)}</b> per tracked prompt
              </div>
              <div className="compare-bar" aria-hidden>
                <span style={{ width: `${Math.min(100, (perPrompt / (COLUMNS[4].price / COLUMNS[4].prompts)) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="table-wrap compare-table">
        <table>
          <thead>
            <tr>
              <th />
              {COLUMNS.map((c) => (
                <th key={c.name + c.sub} className={c.us ? "us" : ""}>
                  {c.name}
                  <span>{c.sub}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Monthly price</td>
              {COLUMNS.map((c) => (
                <td key={c.name + c.sub} className={c.us ? "us" : ""}>
                  {money(c.price)}
                  {c.agency ? "+" : ""}
                </td>
              ))}
            </tr>
            <tr>
              <td>Prompts tracked</td>
              {COLUMNS.map((c) => (
                <td key={c.name + c.sub} className={c.us ? "us" : ""}>
                  {c.agency ? "~50 (typical)" : c.prompts}
                </td>
              ))}
            </tr>
            <tr>
              <td>AI engines</td>
              {COLUMNS.map((c) => (
                <td key={c.name + c.sub} className={c.us ? "us" : ""}>
                  {c.engines}
                </td>
              ))}
            </tr>
            <tr>
              <td>AEO site audit</td>
              {COLUMNS.map((c) => (
                <td key={c.name + c.sub} className={c.us ? "us" : ""}>
                  {c.audit ? "✓" : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <td>Branded monthly PDF report</td>
              {COLUMNS.map((c) => (
                <td key={c.name + c.sub} className={c.us ? "us" : ""}>
                  {c.pdf ? "✓" : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <td>Done-for-you option</td>
              {COLUMNS.map((c) => (
                <td key={c.name + c.sub} className={c.us ? "us" : ""}>
                  {c.dfy}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="compare-note">
        You save {money((COLUMNS[1].price - ours.price) * 12)} a year versus Semrush&apos;s AI Visibility toolkit while tracking
        twice as many prompts. Competitor plans and prices are taken from their public pricing pages as of {AS_OF} and may have
        changed. Agency figure is the entry retainer commonly quoted for AEO services.
      </p>
      <div className="compare-cta">
        <Link href="/signup" className="btn">
          Start free, no card needed
        </Link>
        <Link href="/pricing" className="btn ghost">
          See all plans
        </Link>
      </div>
    </section>
  );
}
