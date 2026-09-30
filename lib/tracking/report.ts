import "server-only";
import { and, desc, eq, lt } from "drizzle-orm";
import type { AuditReport, CategoryId, CheckResult } from "../audit/types";
import { db } from "../db";
import { audits, brands, type Brand } from "../db/schema";
import { ENGINES, isEngine, type EngineId } from "./engines";
import { brandVisibility, type BrandVisibility } from "./metrics";

export type Impact = "high" | "medium" | "low";

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  impact: Impact;
  effort: Impact;
  /** Short topic label, e.g. "ChatGPT visibility" or "Structured data". */
  tag: string;
  /** 0–100, higher = do first. */
  priority: number;
  evidence: string[];
  steps: string[];
  /** Technical | Content | Citations | Reference | Visibility — the table's category badge. */
  category: string;
  /** Short task type, e.g. "Add structured data" or "Channel creation". */
  type: string;
  state?: "done" | "dismissed" | "saved";
  stepsDone: number[];
}

export interface EnginePresence {
  engine: EngineId;
  label: string;
  prompts: number;
  mentioned: number;
  cited: number;
}

export interface BrandReport {
  brand: Brand;
  vis: BrandVisibility;
  audit: AuditReport | null;
  auditDate: Date | null;
  /** Headline 0–100 combining AI visibility and site readiness. */
  score: number | null;
  visibilityScore: number | null;
  presence: EnginePresence[];
  webPresence: { key: string; label: string; domain: string; citations: number }[];
  strategy: { label: string; score: number | null; hint: string }[];
  sourceTypes: { type: string; count: number }[];
  recommendations: Recommendation[];
}

const PRESENCE_SITES = [
  { key: "reddit", label: "Reddit", domain: "reddit.com" },
  { key: "youtube", label: "YouTube", domain: "youtube.com" },
  { key: "wikipedia", label: "Wikipedia", domain: "wikipedia.org" },
  { key: "linkedin", label: "LinkedIn", domain: "linkedin.com" },
  { key: "yelp", label: "Yelp", domain: "yelp.com" },
  { key: "x", label: "X", domain: "x.com" },
];

/** Buckets a cited domain into the playbook's source types. */
export function sourceType(domain: string, ownDomain: string): string {
  const d = domain.replace(/^www\./, "");
  if (d === ownDomain || d.endsWith(`.${ownDomain}`)) return "Your site";
  if (/reddit\.com|quora\.com|forum|community|stackexchange/.test(d)) return "Forums & communities";
  if (/youtube\.com|tiktok\.com|vimeo\.com/.test(d)) return "Video";
  if (/yelp\.|bbb\.org|angi\.com|homeadvisor|thumbtack|trustpilot|g2\.com|capterra|google\.com\/maps|yellowpages|nextdoor/.test(d))
    return "Reviews & directories";
  if (/wikipedia\.org|wikidata/.test(d)) return "Encyclopedias";
  if (/linkedin\.com|facebook\.com|x\.com|twitter\.com|instagram\.com/.test(d)) return "Social";
  if (/forbes|nytimes|cnn|bbc|reuters|wsj|bloomberg|news|times|post/.test(d)) return "News & publishers";
  return "Blogs & other sites";
}

function categoryScore(audit: AuditReport | null, id: CategoryId): number | null {
  return audit?.categories.find((c) => c.id === id)?.score ?? null;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function recommendationsFor(brand: Brand, vis: BrandVisibility, audit: AuditReport | null, presence: EnginePresence[]): Recommendation[] {
  const recs: Omit<Recommendation, "stepsDone" | "state">[] = [];
  const own = brand.domain;

  // 1. Engines where the brand never appears.
  for (const e of presence) {
    if (e.prompts === 0) continue;
    const rate = e.mentioned / e.prompts;
    if (rate >= 0.5) continue;
    recs.push({
      id: `engine:${e.engine}`,
      title: `Improve your ${e.label} visibility`,
      detail: `${e.label} named you in ${e.mentioned} of ${e.prompts} tracked answers (${pct(rate)}). Most answers recommend other companies.`,
      impact: rate === 0 ? "high" : "medium",
      effort: "medium",
      tag: `${e.label} visibility`,
      category: "Visibility",
      type: "Engine coverage",
      priority: Math.round(95 - rate * 60),
      evidence: [`Engine: ${e.label}`, `${e.prompts} prompts checked`, `${e.cited} citations of your site`],
      steps: [
        `Open the ${e.label} answers on the Prompts page and note which sources it cites.`,
        "Publish an answer-first page for your highest-value missing prompt (direct answer in the first 50 words, FAQ, schema).",
        "Get listed on two of the cited sources (directories, roundups or threads).",
      ],
    });
  }

  // 2. Prompts where nobody names the brand on any engine.
  const absent = vis.prompts.filter((p) => p.checks.length > 0 && p.checks.every((c) => c.status === "done" && !c.mentioned));
  for (const p of absent.slice(0, 3)) {
    const rivals = [...new Set(p.checks.flatMap((c) => (c.brandsFound ?? []).filter((b) => !b.isOwn).map((b) => b.name)))];
    recs.push({
      id: `prompt:${p.id}`,
      title: `Win the answer to "${p.text.length > 70 ? `${p.text.slice(0, 67)}…` : p.text}"`,
      detail: rivals.length
        ? `No engine named you. They recommended ${rivals.slice(0, 3).join(", ")} instead.`
        : "No engine named you for this question yet.",
      impact: "high",
      effort: "medium",
      tag: p.intent === "local" ? "Local answer" : p.intent === "comparison" ? "Comparison" : "Answer coverage",
      category: "Content",
      type: "Answer page",
      priority: 90,
      evidence: [`${p.checks.length} engines checked`, ...(rivals[0] ? [`Top rival: ${rivals[0]}`] : [])],
      steps: [
        "Write a page whose H1 is this exact question and answer it in the first paragraph.",
        "Add a comparison table, real numbers (prices, response times) and an FAQ block with FAQPage schema.",
        "Link it from your homepage and service pages, then request re-indexing.",
      ],
    });
  }

  // 3. Third-party sources that engines cite, where the brand could be listed.
  const external = vis.sources.filter((s) => !s.domain.endsWith(own)).slice(0, 2);
  for (const s of external) {
    recs.push({
      id: `source:${s.domain}`,
      title: `Get featured on ${s.domain}`,
      detail: `${s.domain} was cited in ${s.citations} AI answer${s.citations === 1 ? "" : "s"} for your prompts. Being mentioned there feeds straight into the answers.`,
      impact: s.citations >= 3 ? "high" : "medium",
      effort: sourceType(s.domain, own) === "Reviews & directories" ? "low" : "medium",
      tag: "Citations",
      category: "Citations",
      type: sourceType(s.domain, own) === "Forums & communities" ? "Community answer" : "Get listed",
      priority: Math.min(88, 60 + s.citations * 6),
      evidence: [`Source type: ${sourceType(s.domain, own)}`, `${s.citations} citations`],
      steps: [
        `Open the cited page on ${s.domain} and see who is listed.`,
        sourceType(s.domain, own) === "Forums & communities"
          ? "Join the thread with a genuinely useful, specific answer from a real account (no fake accounts)."
          : "Claim or request a listing, or pitch the author to include you.",
        "Re-check the prompt next run to see if the answer changes.",
      ],
    });
  }

  // 4. Site fixes from the latest audit.
  for (const c of (audit?.actionPlan ?? []).slice(0, 6) as CheckResult[]) {
    recs.push({
      id: `audit:${c.id}`,
      title: c.title,
      detail: c.recommendation ?? c.detail,
      impact: c.impact,
      effort: c.effort,
      tag: { crawler: "AI crawler access", schema: "Structured data", content: "Answer-ready content", trust: "Trust signals", technical: "Technical", visibility: "Visibility" }[c.category],
      category: c.category === "content" ? "Content" : c.category === "trust" ? "Reference" : "Technical",
      type: c.title.replace(/^(Structured data|Content)\s*/i, "").split(/[(:—-]/)[0].trim().slice(0, 28),
      priority: Math.round((c.impact === "high" ? 85 : c.impact === "medium" ? 65 : 45) + (c.effort === "low" ? 8 : 0) - c.score * 20),
      evidence: [`Site audit: ${c.detail.slice(0, 80)}${c.detail.length > 80 ? "…" : ""}`],
      steps: ["Review the finding in the Site audit.", "Ship the fix on your website.", "Re-run the audit to confirm."],
    });
  }

  // 5. Reference profiles AI engines lean on (Wikipedia, YouTube, LinkedIn, X), from the audit's link checks.
  if (audit) {
    const linked = audit.checks
      .filter((c) => c.id === "social-profiles" || c.id === "sameas-links")
      .map((c) => `${c.detail} ${(c.evidence ?? []).join(" ")}`)
      .join(" ")
      .toLowerCase();
    const cited = new Map(vis.sources.map((x) => [x.domain, x.citations]));
    const REF = [
      { key: "wikipedia", label: "Wikipedia", match: /wikipedia\.org|wikidata/, type: "Wikipedia presence", effort: "high" as Impact, title: "Create or improve your Wikipedia presence" },
      { key: "youtube", label: "YouTube", match: /youtube\.com/, type: "Channel creation", effort: "medium" as Impact, title: "Create or verify your official YouTube channel" },
      { key: "linkedin", label: "LinkedIn", match: /linkedin\.com/, type: "Profile creation", effort: "low" as Impact, title: "Create or verify your LinkedIn company page" },
      { key: "x", label: "X", match: /(^|\W)(x\.com|twitter\.com)/, type: "Profile creation", effort: "low" as Impact, title: "Create or verify your official X profile" },
    ];
    for (const r of REF) {
      if (r.match.test(linked)) continue;
      const cites = [...cited.entries()].filter(([d]) => r.match.test(d)).reduce((n, [, v]) => n + v, 0);
      recs.push({
        id: `ref:${r.key}`,
        title: r.title,
        detail: `No official ${r.label} profile is linked from your site${cites ? `, yet ${r.label} was cited ${cites} time${cites === 1 ? "" : "s"} in answers for your prompts` : ""}. AI engines use these profiles to confirm who you are.`,
        impact: cites ? "high" : "medium",
        effort: r.effort,
        tag: `${r.label} presence`,
        category: "Reference",
        type: r.type,
        priority: Math.min(80, 44 + cites * 3 + (r.effort === "low" ? 6 : 0)),
        evidence: [`Platform: ${r.label}`, "Site audit", ...(cites ? [`${cites} citations`] : [])],
        steps: [
          `Create or claim the official ${r.label} ${r.key === "wikipedia" ? "entry (or Wikidata item)" : "profile"} using your exact business name.`,
          "Add your website, address and a clear one-sentence description of what you do.",
          "Link it from your site footer and add it to the sameAs list in your Organization schema.",
        ],
      });
    }
  }

  const state = brand.recState ?? {};
  const steps = brand.recSteps ?? {};
  return recs
    .map((r) => ({ ...r, state: state[r.id], stepsDone: steps[r.id] ?? [] }))
    .sort((a, b) => Number(a.state === "done" || a.state === "dismissed") - Number(b.state === "done" || b.state === "dismissed") || b.priority - a.priority);
}

/**
 * Everything the dashboard and the monthly PDF show for a brand.
 * `before` limits data to runs and audits before that date (for a past month's report).
 */
export async function buildBrandReport(brandId: string, before?: Date): Promise<BrandReport | null> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) return null;
  const vis = await brandVisibility(brandId, 12, before);
  const [auditRow] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.brandId, brandId), before ? lt(audits.createdAt, before) : undefined))
    .orderBy(desc(audits.createdAt))
    .limit(1);
  const audit = (auditRow?.report as AuditReport | undefined) ?? null;

  const presence: EnginePresence[] = [];
  for (const engine of brand.engines.filter(isEngine)) {
    const rows = vis.prompts.flatMap((p) => p.checks.filter((c) => c.engine === engine && c.status === "done"));
    presence.push({
      engine,
      label: ENGINES[engine].label,
      prompts: rows.length,
      mentioned: rows.filter((c) => c.mentioned).length,
      cited: rows.filter((c) => c.cited).length,
    });
  }

  const allSources = vis.prompts.flatMap((p) => p.checks.flatMap((c) => c.sources ?? []));
  const webPresence = PRESENCE_SITES.map((s) => ({
    ...s,
    citations: allSources.filter((x) => x.domain.replace(/^www\./, "").endsWith(s.domain)).length,
  }));
  const typeCounts = new Map<string, number>();
  for (const s of allSources) {
    const t = sourceType(s.domain, brand.domain);
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const sourceTypes = [...typeCounts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  const visibilityScore = vis.latest
    ? Math.round(100 * (0.6 * vis.latest.mentionRate + 0.25 * vis.latest.citationRate + 0.15 * Math.min(vis.latest.shareOfVoice * 2, 1)))
    : null;
  const score =
    visibilityScore != null && audit ? Math.round((visibilityScore + audit.overall) / 2) : (visibilityScore ?? audit?.overall ?? null);

  const strategy = [
    { label: "Answerability", score: categoryScore(audit, "content"), hint: "Content written as clear, quotable answers" },
    { label: "Structured data", score: categoryScore(audit, "schema"), hint: "Schema.org markup and entity clarity" },
    { label: "AI crawler access", score: categoryScore(audit, "crawler"), hint: "Whether AI bots can reach and read your pages" },
    { label: "Trust signals", score: categoryScore(audit, "trust"), hint: "Authors, reviews, contact details, freshness" },
  ];

  return {
    brand,
    vis,
    audit,
    auditDate: auditRow?.createdAt ?? null,
    score,
    visibilityScore,
    presence,
    webPresence,
    strategy,
    sourceTypes,
    recommendations: recommendationsFor(brand, vis, audit, presence),
  };
}
