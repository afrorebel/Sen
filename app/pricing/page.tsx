import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";
import { PLANS } from "@/lib/plans";

export const metadata = {
  title: "Pricing · AEOGrowthLeads",
  description: "Affordable AI visibility tracking for ChatGPT, Google AI Mode, Perplexity, Gemini and Claude, plus done-for-you AEO.",
};

const COMPARE = [
  { label: "Tracking ~50 prompts", us: "$49/mo (Starter)", them: "Semrush One Starter: $199/mo for 50 prompts" },
  { label: "Cheapest paid AI-visibility plan", us: "$49/mo for 50 prompts", them: "Semrush AI Visibility: $99/mo for 25 prompts" },
  { label: "Done-for-you AEO", us: "From $799/mo, no setup fee", them: "Agencies: $1,500–5,500/mo, often paid upfront" },
];

export default function PricingPage() {
  const selfServe = [PLANS.free, PLANS.starter, PLANS.growth, PLANS.agency];
  const dfy = PLANS.dfy;
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className="hero" style={{ paddingBottom: 24 }}>
          <div className="eyebrow">Pricing</div>
          <h1>Get named in AI answers for less</h1>
          <p className="lede">
            Track how ChatGPT, Google AI Mode, Perplexity, Gemini and Claude talk about your business. Pay for software,
            or let our team do the work.
          </p>
        </section>

        <section className="plans">
          {selfServe.map((p) => (
            <div key={p.id} className={`plan card ${p.highlight ? "featured" : ""}`}>
              {p.highlight && <div className="ribbon">Most popular</div>}
              <h2>{p.name}</h2>
              <p className="muted">{p.tagline}</p>
              <div className="price">
                ${p.monthly}
                <span>/mo</span>
              </div>
              <p className="muted small">{p.monthly ? `$${p.annualMonthly}/mo billed annually` : "Free forever"}</p>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className={`btn ${p.highlight ? "" : "ghost"}`}>
                {p.monthly ? "Start free, upgrade anytime" : "Start free"}
              </Link>
            </div>
          ))}
        </section>

        <section className="card dfy-band">
          <div>
            <div className="eyebrow">Done For You</div>
            <h2>Let our team get you cited</h2>
            <p className="muted">{dfy.tagline} Includes the full platform, plus:</p>
            <ul>
              {dfy.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="dfy-price">
            <div className="price">
              from ${dfy.monthly}
              <span>/mo</span>
            </div>
            <p className="muted small">No setup fee. Month to month.</p>
            <a className="btn" href="mailto:hello@aeogrowthleads.com?subject=Done-for-you%20AEO">
              Book a strategy call
            </a>
          </div>
        </section>

        <section className="card" style={{ margin: "20px 0 64px" }}>
          <h2>How we compare</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>AEOGrowthLeads</th>
                  <th>Typical alternatives</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>
                      <b>{r.us}</b>
                    </td>
                    <td className="muted">{r.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Competitor figures are from their public pricing pages as of September 2026.</p>
        </section>
      </main>
    </>
  );
}
