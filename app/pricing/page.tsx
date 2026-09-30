import Link from "next/link";
import { PlanMatrix } from "@/app/components/plan-matrix";
import { PriceCompare } from "@/app/components/price-compare";
import { SiteFooter, SiteHeader } from "@/app/components/site-header";
import { PLANS } from "@/lib/plans";

export const metadata = {
  title: "Pricing · AEO GrowthLead",
  description: "Affordable AI visibility tracking for ChatGPT, Google AI Mode, Perplexity, Gemini and Claude, plus done-for-you AEO.",
};

export default function PricingPage() {
  const selfServe = [PLANS.free, PLANS.starter, PLANS.growth, PLANS.agency];
  const dfy = PLANS.dfy;
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className="hero pricing-hero">
          <span className="kicker"><i /> Pricing</span>
          <h1>
            Get named in AI answers <mark>for less</mark>
          </h1>
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
                {p.monthly ? `Start with ${p.name}` : "Start free"}
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
            <a className="btn" href="mailto:hello@aeogrowthlead.com?subject=Done-for-you%20AEO">
              Book a strategy call
            </a>
          </div>
        </section>

        <PlanMatrix />

        <PriceCompare />
      </main>
      <SiteFooter />
    </>
  );
}
