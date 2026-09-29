import { buildContext, check, typesOf } from "./context";
import { normalizeUrl } from "./fetcher";
import { contentChecks } from "./checks/content";
import { crawlerAccess, crawlerChecks } from "./checks/crawler";
import { schemaChecks } from "./checks/schema";
import { technicalChecks } from "./checks/technical";
import { trustChecks } from "./checks/trust";
import { runVisibilityProbe, visibilityEnabled, type SiteSummary } from "./visibility";
import type { AuditReport, CategoryId, CategoryScore, CheckResult, VisibilityResult } from "./types";

export const CATEGORIES: Record<CategoryId, { label: string; description: string; weight: number }> = {
  crawler: {
    label: "AI Crawler Access",
    description: "Can ChatGPT, Claude, Perplexity, Gemini and Copilot bots reach and index your pages?",
    weight: 25,
  },
  content: {
    label: "Answer-Ready Content",
    description: "Is your content structured as clear, quotable answers to the questions buyers ask?",
    weight: 25,
  },
  schema: {
    label: "Structured Data & Entity",
    description: "Does schema.org markup tell engines unambiguously who you are and what you offer?",
    weight: 20,
  },
  trust: {
    label: "Authority & Trust (E-E-A-T)",
    description: "Are there signals of expertise, real-world identity, freshness and third-party proof?",
    weight: 15,
  },
  technical: {
    label: "Technical Foundations",
    description: "Metadata, HTTPS, speed and page weight that affect how pages are fetched and summarised.",
    weight: 15,
  },
  visibility: {
    label: "AI Visibility (GEO)",
    description: "When real buyer questions are asked of an AI assistant, is your brand mentioned or cited?",
    weight: 25,
  },
};

const IMPACT = { high: 3, medium: 2, low: 1 } as const;
const EFFORT = { low: 1, medium: 2, high: 3 } as const;

export interface AuditOptions {
  brand?: string;
  /** Run the LLM visibility probe (needs ANTHROPIC_API_KEY). Defaults to true when a key is configured. */
  visibility?: boolean;
  promptCount?: number;
}

function visibilityChecks(v: VisibilityResult): CheckResult[] {
  if (v.error || v.prompts.length === 0) return [];
  const n = v.prompts.length;
  const mentioned = v.prompts.filter((p) => p.mentioned).length;
  const cited = v.prompts.filter((p) => p.cited).length;
  const top = v.topCompetitors.slice(0, 3).map((c) => c.name);
  return [
    check({
      id: "ai-mentions",
      category: "visibility",
      title: "Brand is mentioned in AI answers",
      status: mentioned / n >= 0.6 ? "pass" : mentioned > 0 ? "warn" : "fail",
      score: mentioned / n,
      detail: `Mentioned in ${mentioned} of ${n} buyer-intent answers.${top.length ? ` Most-recommended alternatives: ${top.join(", ")}.` : ""}`,
      recommendation:
        "Earn mentions where AI engines look: publish comparison and \"best X for Y\" pages, get listed in third-party roundups, directories and review sites, and keep your entity data consistent everywhere.",
      impact: "high",
      effort: "high",
      weight: 3,
    }),
    check({
      id: "ai-citations",
      category: "visibility",
      title: "Your site is used as a cited source",
      status: cited / n >= 0.4 ? "pass" : cited > 0 ? "warn" : "fail",
      score: Math.min(cited / n / 0.4, 1),
      detail: `Your domain appeared in the retrieved or cited sources for ${cited} of ${n} answers.`,
      recommendation:
        "Create pages that directly answer these prompts (one question per page/section, answer in the first paragraph, with data and FAQ schema) so search-grounded assistants retrieve and cite you.",
      impact: "high",
      effort: "medium",
      weight: 2,
    }),
  ];
}

function scoreCategories(checks: CheckResult[], ids: CategoryId[]): CategoryScore[] {
  return ids.map((id) => {
    const scored = checks.filter((c) => c.category === id && c.status !== "info");
    const totalWeight = scored.reduce((n, c) => n + c.weight, 0);
    const earned = scored.reduce((n, c) => n + c.weight * c.score, 0);
    return {
      id,
      ...CATEGORIES[id],
      score: totalWeight ? Math.round((earned / totalWeight) * 100) : 0,
      passed: scored.filter((c) => c.status === "pass").length,
      total: scored.length,
    };
  });
}

function priority(c: CheckResult): number {
  return (IMPACT[c.impact] * c.weight * (1 - c.score)) / EFFORT[c.effort];
}

function detectBrand(ctx: Awaited<ReturnType<typeof buildContext>>): string {
  const org = ctx.jsonLd.find((n) => typesOf(n).some((t) => /Organization|Business|Corporation|ProfessionalService|Store|Restaurant/.test(t)) && typeof n.name === "string");
  if (org) return String(org.name);
  const site = ctx.$('meta[property="og:site_name"]').attr("content");
  if (site) return site.trim();
  const title = ctx.$("title").text().split(/[|\-–—:·]/).map((s) => s.trim()).filter(Boolean);
  const host = new URL(ctx.page.finalUrl).hostname.replace(/^www\./, "");
  const root = host.split(".")[0];
  return title.find((t) => t.toLowerCase().replace(/\s/g, "").includes(root.toLowerCase())) ?? root;
}

const SEMANTIC = new Set([
  "a", "article", "aside", "blockquote", "body", "button", "caption", "details", "dialog", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "html", "img", "label", "li", "link", "main",
  "mark", "meta", "nav", "ol", "p", "picture", "script", "section", "small", "summary", "svg", "table", "tbody", "td",
  "th", "thead", "time", "title", "tr", "ul", "video",
]);

function semanticSummary($: Awaited<ReturnType<typeof buildContext>>["$"]) {
  const tags = new Set<string>();
  let semantic = 0;
  let nonSemantic = 0;
  $("*").each((_, el) => {
    const name = "tagName" in el ? String(el.tagName).toLowerCase() : "";
    if (!name) return;
    if (SEMANTIC.has(name)) {
      semantic++;
      tags.add(name);
    } else {
      nonSemantic++;
    }
  });
  return { tags: [...tags].sort(), semantic, nonSemantic };
}

export async function runAudit(inputUrl: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const started = Date.now();
  const url = normalizeUrl(inputUrl);
  const ctx = await buildContext(url.href);
  const domain = new URL(ctx.page.finalUrl).hostname;
  const brand = opts.brand?.trim() || detectBrand(ctx);

  const access = crawlerAccess(ctx);
  const checks = [
    ...crawlerChecks(ctx, access),
    ...contentChecks(ctx),
    ...schemaChecks(ctx),
    ...trustChecks(ctx),
    ...technicalChecks(ctx),
  ];

  let visibility: VisibilityResult | undefined;
  const wantVisibility = opts.visibility ?? true;
  if (wantVisibility && visibilityEnabled()) {
    const summary: SiteSummary = {
      brand,
      domain,
      title: ctx.$("title").text().trim(),
      description: ctx.$('meta[name="description"]').attr("content") ?? "",
      h1: ctx.$("h1").first().text().trim(),
      excerpt: ctx.text,
    };
    visibility = await runVisibilityProbe(summary, opts.promptCount ?? 5);
    checks.push(...visibilityChecks(visibility));
  }

  const ids = (Object.keys(CATEGORIES) as CategoryId[]).filter(
    (id) => id !== "visibility" || checks.some((c) => c.category === "visibility"),
  );
  const categories = scoreCategories(checks, ids);
  const totalWeight = categories.reduce((n, c) => n + c.weight, 0);
  const overall = Math.round(categories.reduce((n, c) => n + c.score * c.weight, 0) / totalWeight);

  const open = checks.filter((c) => c.status === "fail" || c.status === "warn");
  const actionPlan = [...open].sort((a, b) => priority(b) - priority(a));
  const quickWins = actionPlan.filter((c) => c.effort === "low" && c.impact !== "low").slice(0, 5);

  return {
    url: inputUrl,
    finalUrl: ctx.page.finalUrl,
    domain,
    brand,
    auditedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    overall,
    band: overall <= 40 ? "low" : overall <= 70 ? "moderate" : "high",
    categories,
    checks,
    crawlers: access,
    actionPlan,
    quickWins,
    visibility,
    page: {
      title: ctx.$("title").text().trim(),
      description: ctx.$('meta[name="description"]').attr("content") ?? "",
      wordCount: ctx.text.split(/\s+/).filter(Boolean).length,
      responseMs: ctx.page.responseMs,
      bytes: ctx.page.bytes,
      schemaTypes: ctx.schemaTypes,
      semantics: semanticSummary(ctx.$),
    },
  };
}
