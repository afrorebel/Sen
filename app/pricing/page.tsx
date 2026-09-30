import Link from "next/link";
import { PlanMatrix } from "@/app/components/plan-matrix";
import { PriceCompare } from "@/app/components/price-compare";
import { SiteFooter, SiteHeader } from "@/app/components/site-header";
import { PLANS, perMonthYearly, SELF_SERVE } from "@/lib/plans";
import { bookingUrl } from "@/lib/site";

export const metadata = {
  title: "Pricing · AEO GrowthLead",
  description: "AI visibility tracking for ChatGPT, Google AI Mode, Perplexity, Gemini and Claude. Free, Pro and Agency plans, plus done-for-you AEO.",
};

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const yearly = (await searchParams).billing === "year";
  const dfy = PLANS.dfy;
  const booking = bookingUrl();
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className="hero pricing-hero">
          <span className="kicker">
            <i /> Pricing
          </span>
          <h1>
            Get named in AI answers <mark>for less</mark>
          </h1>
          <p className="lede">
            Track how ChatGPT, Google AI Mode, Perplexity, Gemini and Claude talk about your business. Pay for software, or let
            our team do the work.
          </p>
          <nav className="segmented billing-toggle" aria-label="Billing period">
            <Link href="/pricing" scroll={false} aria-current={!yearly ? "true" : undefined}>
              Monthly
            </Link>
            <Link href="/pricing?billing=year" scroll={false} aria-current={yearly ? "true" : undefined}>
              Yearly <span className="save">2 months free</span>
            </Link>
          </nav>
        </section>

        <section className="plans plans-3">
          {SELF_SERVE.map((id) => {
            const p = PLANS[id];
            const paid = Boolean(p.monthly);
            return (
              <div key={p.id} className={`plan card ${p.highlight ? "featured" : ""}`}>
                {p.highlight && <div className="ribbon">Most popular</div>}
                <h2>{p.name}</h2>
                <p className="muted">{p.tagline}</p>
                <div className="price">
                  ${yearly && paid ? perMonthYearly(p) : p.monthly}
                  <span>/mo</span>
                </div>
                <p className="muted small">
                  {!paid ? "Free forever, no card needed" : yearly ? `$${p.yearly!.toLocaleString("en-US")} billed yearly` : "Billed monthly, cancel any time"}
                </p>
                <ul>
                  {p.bullets.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link href={paid ? `/signup?plan=${p.id}&billing=${yearly ? "year" : "month"}` : "/signup"} className={`btn ${p.highlight ? "" : "ghost"}`}>
                  {paid ? `Start with ${p.name}` : "Start free"}
                </Link>
              </div>
            );
          })}
        </section>

        <section className="card dfy-band">
          <div>
            <div className="eyebrow">Done For You</div>
            <h2>Let our team get you cited</h2>
            <p className="muted">{dfy.tagline} Includes the full platform, plus:</p>
            <ul>
              {dfy.bullets.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="dfy-price">
            <div className="price quote">Custom quote</div>
            <p className="muted small">Scoped to your market and goals on a short call.</p>
            <a className="btn" href={booking} target={booking.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              Book a call
            </a>
          </div>
        </section>

        <PlanMatrix yearly={yearly} booking={booking} />

        <PriceCompare />
      </main>
      <SiteFooter />
    </>
  );
}
