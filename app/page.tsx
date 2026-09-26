"use client";

import { useEffect, useState } from "react";
import { Report } from "./report";
import type { AuditReport } from "@/lib/audit/types";

const STEPS = [
  "Fetching the page",
  "Reading robots.txt, sitemap & llms.txt",
  "Testing access as GPTBot, ClaudeBot & PerplexityBot",
  "Analysing structured data & entity signals",
  "Scoring content for answerability",
  "Asking AI assistants buyer questions",
  "Building your action plan",
];

const FEATURES = [
  { title: "AI crawler access", body: "Checks robots.txt, meta directives and firewall behaviour for 16 AI bots including GPTBot, ClaudeBot, PerplexityBot and Google-Extended." },
  { title: "Answer-ready content", body: "Scores question headings, answer-first summaries, facts, citations, readability and whether content renders without JavaScript." },
  { title: "Entity & schema", body: "Validates Organization, FAQ, Product/Service and review markup, plus sameAs links that tie your brand to the knowledge graph." },
  { title: "AI visibility (GEO)", body: "Asks an AI assistant with live web search the questions your buyers ask, then measures mentions, citations and share of voice." },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [visibility, setVisibility] = useState(true);
  const [visibilityAvailable, setVisibilityAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((d) => setVisibilityAvailable(Boolean(d.visibilityAvailable)))
      .catch(() => setVisibilityAvailable(false));
    const initial = new URLSearchParams(window.location.search).get("url");
    if (initial) setUrl(initial);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const runsProbe = visibility && visibilityAvailable;
    const last = runsProbe ? STEPS.length - 1 : STEPS.length - 2;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, last)), runsProbe ? 6000 : 1800);
    return () => clearInterval(id);
  }, [loading, visibility, visibilityAvailable]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setStep(0);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, brand: brand || undefined, visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setReport(data);
      const params = new URLSearchParams({ url });
      window.history.replaceState(null, "", `?${params}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  const steps = visibility && visibilityAvailable ? STEPS : STEPS.filter((_, i) => i !== 5);

  return (
    <main className="wrap">
      <section className={`hero ${report ? "no-print" : ""}`} style={report ? { paddingTop: 32, paddingBottom: 8 } : undefined}>
        {!report && <div className="eyebrow">AEO · GEO · AI Search Readiness</div>}
        {!report && <h1>Will AI recommend your business?</h1>}
        {!report && (
          <p className="lede">
            Audit any website for Answer Engine Optimization and Generative Engine Optimization. See how ChatGPT,
            Claude, Perplexity, Gemini and Google AI Overviews can crawl, understand and cite you, then get a
            prioritised fix list.
          </p>
        )}
        <form className="form" onSubmit={run}>
          <input
            type="text"
            inputMode="url"
            placeholder="yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Website URL"
            required
          />
          <input
            type="text"
            className="brand"
            placeholder="Brand name (optional)"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            aria-label="Brand name"
          />
          <button className="btn" disabled={loading}>
            {loading ? "Auditing…" : "Run audit"}
          </button>
          <div className="opts">
            <label>
              <input
                type="checkbox"
                checked={visibility && visibilityAvailable !== false}
                disabled={visibilityAvailable === false}
                onChange={(e) => setVisibility(e.target.checked)}
              />
              Include AI visibility test
              {visibilityAvailable === false && " (set ANTHROPIC_API_KEY to enable)"}
            </label>
          </div>
        </form>
        {error && <div className="error" role="alert">{error}</div>}
      </section>

      {loading && (
        <ul className="progress" aria-live="polite">
          {steps.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "active" : ""}>
              <span className="dot" />
              {s}
            </li>
          ))}
        </ul>
      )}

      {report && <Report report={report} />}

      {!report && !loading && (
        <section className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
