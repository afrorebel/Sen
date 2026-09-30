import Link from "next/link";
import { EngineIcon } from "./components/logo";
import { PriceCompare } from "./components/price-compare";
import { SiteFooter, SiteHeader } from "./components/site-header";
import { bookingUrl } from "@/lib/site";

export const metadata = {
  title: "AEO GrowthLead — See when AI recommends you, and who it recommends instead",
  description:
    "Track your brand across ChatGPT, Google AI Mode, Perplexity, Gemini and Claude. Prompt tracking, cited sources, competitor share of voice, site audits and monthly PDF reports. Free plan, Pro from $66/month.",
};

const ENGINES = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "google_ai_mode", label: "Google AI Mode" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
];

const FEATURES = [
  { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", title: "Prompt tracking", body: "The questions your buyers ask, checked every week on every major AI engine." },
  { icon: "M18 20V10M12 20V4M6 20v-6", title: "Competitor share of voice", body: "Who gets recommended instead of you, how often, and on which engines." },
  { icon: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7", title: "Cited sources", body: "The Reddit threads, listicles and directories the engines trust in your niche." },
  { icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4", title: "AEO site audit", body: "AI crawler access, schema, answer-ready content and trust signals, scored." },
  { icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", title: "Prioritised recommendations", body: "What to fix next, ranked by impact, with the evidence and the steps." },
  { icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5", title: "Monthly PDF reports", body: "A branded, client-ready report emailed on the 1st of every month." },
  { icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", title: "Client portal", body: "Give clients a read-only login to follow results and deliverables." },
  { icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z", title: "Done-for-you option", body: "Prefer not to do the work? Our team ships the fixes and content for you." },
];

const FAQ = [
  {
    q: "What is AEO / GEO?",
    a: "Answer Engine Optimization (also called Generative Engine Optimization) is the work of getting your business named and cited when people ask AI assistants like ChatGPT, Gemini, Perplexity, Claude and Google's AI Mode for recommendations.",
  },
  {
    q: "How do you check what the AI engines say?",
    a: "We send your tracked prompts to each engine on a schedule, save every answer, and record whether you were named, where you ranked among the brands named, and which sources were cited.",
  },
  {
    q: "Which AI engines do you track?",
    a: "ChatGPT, Google AI Mode, Perplexity, Gemini and Claude. Pro and Agency track all five; the Free plan tracks one.",
  },
  {
    q: "How is this different from SEO rank tracking?",
    a: "AI answers don't have ten blue links. They name a few companies and cite a handful of sources. We measure mentions, citations and share of voice, which is what decides whether a buyer hears your name.",
  },
  {
    q: "Can you do the work for me?",
    a: "Yes. Done For You covers technical fixes, schema, answer-first articles, citation building and a monthly report, all tracked inside your dashboard. It's priced per project after a short call.",
  },
  {
    q: "Is there a contract?",
    a: "No. Pro and Agency are month to month and you can cancel any time from the billing page. Yearly billing gets you two months free.",
  },
];

function Shot({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`shot ${className}`}>
      <div className="shot-bar" aria-hidden>
        <i />
        <i />
        <i />
        <span>app.aeogrowthlead.com</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function Home() {
  const booking = bookingUrl();
  return (
    <>
      <SiteHeader />
      <main className="mkt">
        <section className="mkt-hero">
          <div className="wrap hero-grid">
            <div>
              <span className="kicker">
                <i /> AI visibility platform · AEO &amp; GEO
              </span>
              <h1>
                See when <mark>AI&nbsp;recommends&nbsp;you,</mark> and who it recommends instead
              </h1>
              <p className="lede">
                Track your brand across ChatGPT, Google AI Mode, Perplexity, Gemini and Claude. See every answer, every source
                and every competitor, then get told exactly what to fix. <b>Start free. Pro from $66 a month.</b>
              </p>
              <div className="hero-cta">
                <Link href="/signup" className="btn big">
                  Start tracking free →
                </Link>
                <Link href="/audit" className="btn ghost big">
                  Run a free audit
                </Link>
              </div>
              <p className="hint">Free forever for 1 brand and 10 prompts. No card required.</p>
              <div className="engine-row">
                <span className="small-caps">Tracks</span>
                {ENGINES.map((e) => (
                  <span key={e.id} className="engine-pill">
                    <EngineIcon engine={e.id} size={18} /> {e.label}
                  </span>
                ))}
              </div>
            </div>
            <Shot src="/screens/dashboard.png" alt="AEO GrowthLead dashboard showing AEO score, mention rate and AI presence by engine" className="hero-shot" />
          </div>
        </section>

        <section className="stats-band">
          <div className="wrap stats-grid">
            <div>
              <b>5</b>
              <span>AI engines tracked</span>
            </div>
            <div>
              <b>$0.79</b>
              <span>per tracked prompt on Pro</span>
            </div>
            <div>
              <b>16</b>
              <span>AI crawlers checked in every audit</span>
            </div>
            <div>
              <b>1st</b>
              <span>of the month: your PDF report arrives</span>
            </div>
          </div>
        </section>

        <section className="wrap mkt-section" id="features">
          <div className="section-head">
            <p className="eyebrow">The dashboard</p>
            <h2>Everything AI says about your business, in one place</h2>
            <p className="lede">No more typing prompts into four chatbots and pasting answers into a spreadsheet.</p>
          </div>

          <div className="feature-row">
            <div>
              <h3>Know where you stand on every engine</h3>
              <p>
                Your AEO score, mention rate, citation rate and share of voice, with engine-by-engine presence and the prompts
                that matter most. Watch the trend move after every check.
              </p>
              <ul className="ticks">
                <li>AI presence for ChatGPT, Google AI Mode, Perplexity, Gemini and Claude</li>
                <li>Competitor landscape and share of voice</li>
                <li>Strategy review from your site audit</li>
              </ul>
            </div>
            <Shot src="/screens/panels.png" alt="AI presence, key prompts, competitor landscape and strategy review panels" />
          </div>

          <div className="feature-row reverse">
            <div>
              <h3>Read every answer, and every source it used</h3>
              <p>
                Open any prompt to see what each engine said, whether it named you, where you ranked, the sites it cited and the
                sub-searches it ran. That&apos;s where your next win comes from.
              </p>
              <ul className="ticks">
                <li>Full answer text for every engine</li>
                <li>Cited sources with your own site highlighted</li>
                <li>Query fan-outs the engines searched</li>
              </ul>
            </div>
            <Shot src="/screens/full-report.png" alt="Prompt report showing each AI engine's answer, cited sources and query fan-outs" />
          </div>

          <div className="feature-row">
            <div>
              <h3>Know exactly what to do next</h3>
              <p>
                Recommendations are ranked by impact and effort and backed by evidence from your own data: the engine you&apos;re
                missing, the prompt a rival owns, the directory you&apos;re not on. Mark them done, or push them to your task board.
              </p>
              <ul className="ticks">
                <li>Priority score, impact and effort for every action</li>
                <li>Step-by-step checklists you can tick off</li>
                <li>Save, dismiss or push to your team&apos;s task board</li>
              </ul>
            </div>
            <Shot src="/screens/recommendations.png" alt="Tasks page with top opportunities ranked by impact, effort and evidence" />
          </div>

          <div className="feature-row reverse">
            <div>
              <h3>See AI crawlers and AI visitors on your site</h3>
              <p>
                Upload a server log or connect a log drain to see which AI crawlers read your pages and which ones hit errors. Add
                one line of script to count the visitors ChatGPT, Perplexity, Gemini and Claude send you.
              </p>
              <ul className="ticks">
                <li>GPTBot, ClaudeBot, PerplexityBot and 20+ other crawlers</li>
                <li>AI-referred visits and landing pages</li>
                <li>No cookies and no personal data</li>
              </ul>
            </div>
            <Shot src="/screens/traffic.png" alt="AI Traffic page with crawler hits, AI-referred visits and a daily activity chart" />
          </div>

          <div className="feature-row">
            <div>
              <h3>A client-ready PDF on the 1st of every month</h3>
              <p>
                Score, share of voice, engine results, competitors, sources, site readiness, work delivered and next month&apos;s
                priorities, emailed automatically to you or your client.
              </p>
              <ul className="ticks">
                <li>Branded, multi-page PDF</li>
                <li>Month-over-month changes</li>
                <li>Send on demand or on a schedule</li>
              </ul>
            </div>
            <div className="pdf-stack">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/screens/pdf-page-2.png" alt="Monthly report inner page" className="pdf-back" loading="lazy" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/screens/pdf-cover.png" alt="Monthly AI visibility report cover page" className="pdf-front" loading="lazy" />
            </div>
          </div>
        </section>

        <section className="grid-band">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">Features</p>
              <h2>Built for businesses, and the agencies that serve them</h2>
            </div>
            <div className="feature-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature-card">
                  <span className="feature-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={f.icon} />
                    </svg>
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap mkt-section" id="how">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>Up and running in five minutes</h2>
          </div>
          <div className="steps-grid">
            <div className="step">
              <span>1</span>
              <h3>Add your brand</h3>
              <p>Your website, what you sell, where you sell it and who you compete with.</p>
            </div>
            <div className="step">
              <span>2</span>
              <h3>Pick your prompts</h3>
              <p>We suggest the questions buyers ask, grouped by best-of, problem, comparison and local.</p>
            </div>
            <div className="step">
              <span>3</span>
              <h3>Watch the answers</h3>
              <p>We check every engine on schedule and tell you what to fix to get named.</p>
            </div>
          </div>
        </section>

        <div className="wrap">
          <PriceCompare />
        </div>

        <section className="dfy-dark">
          <div className="wrap dfy-grid">
            <div>
              <p className="eyebrow">Done for you</p>
              <h2>Rather have it handled?</h2>
              <p>
                Our team runs the whole playbook: technical fixes, schema, answer-first articles, citations and your Google
                Business Profile. You follow every task and deliverable in your dashboard.
              </p>
              <div className="hero-cta">
                <a className="btn big" href={booking} target={booking.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  Book a call for a quote
                </a>
              </div>
            </div>
            <Shot src="/screens/dfy-board.png" alt="Done-for-you task board with tasks and deliverables" />
          </div>
        </section>

        <section className="wrap mkt-section faq">
          <div className="section-head">
            <p className="eyebrow">FAQ</p>
            <h2>Questions, answered</h2>
          </div>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="final-cta">
          <div className="wrap">
            <h2>Find out if AI recommends you, today</h2>
            <p>Start free with 10 prompts on ChatGPT and Google AI Mode. Upgrade when you&apos;re ready.</p>
            <div className="hero-cta center">
              <Link href="/signup" className="btn big">
                Start tracking free →
              </Link>
              <Link href="/audit" className="btn ghost big on-dark">
                Run a free audit
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
