import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { FetchError, fetchPage, tryFetch } from "./fetcher";
import { parseRobots, type ParsedRobots } from "./robots";
import type { CheckResult, PageSnapshot } from "./types";

export interface BotProbe {
  bot: string;
  status: number | null;
  blocked: boolean;
}

export interface AuditContext {
  page: PageSnapshot;
  origin: string;
  $: CheerioAPI;
  /** Visible body text with scripts/styles/nav chrome stripped. */
  text: string;
  robotsTxt: string | null;
  robots: ParsedRobots | null;
  llmsTxt: string | null;
  llmsFullTxt: string | null;
  sitemapXml: string | null;
  sitemapUrl: string | null;
  jsonLd: Record<string, unknown>[];
  schemaTypes: string[];
  botProbes: BotProbe[];
}

/** User agents we impersonate to detect CDN / WAF blocks that robots.txt doesn't show. */
const PROBE_AGENTS: Record<string, string> = {
  GPTBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)",
  ClaudeBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
};

function flattenJsonLd(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    node.forEach((n) => flattenJsonLd(n, out));
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj["@graph"]) flattenJsonLd(obj["@graph"], out);
    if (obj["@type"]) out.push(obj);
  }
}

export function typesOf(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
}

async function probeBot(url: string, bot: string, ua: string): Promise<BotProbe> {
  // A 429 is often ordinary rate limiting from our parallel requests, so back off and retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchPage(url, { userAgent: ua, timeoutMs: 10000 });
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { bot, status: res.status, blocked: [401, 403, 429].includes(res.status) || res.status >= 500 };
    } catch {
      return { bot, status: null, blocked: true };
    }
  }
  return { bot, status: 429, blocked: true };
}

export async function buildContext(url: string): Promise<AuditContext> {
  const page = await fetchPage(url);
  if (page.status >= 400) {
    const blocked = [401, 403, 429, 503].includes(page.status);
    throw new FetchError(
      blocked
        ? `The site returned HTTP ${page.status} to our crawler. It is likely behind bot protection, which probably blocks AI crawlers too. Try again in a minute, or allow-list automated agents in your CDN/WAF.`
        : `The page returned HTTP ${page.status}`,
    );
  }
  const final = new URL(page.finalUrl);
  const origin = final.origin;

  const [robotsPage, llmsPage, llmsFullPage] = await Promise.all([
    tryFetch(`${origin}/robots.txt`),
    tryFetch(`${origin}/llms.txt`),
    tryFetch(`${origin}/llms-full.txt`),
  ]);
  const botProbes: BotProbe[] = [];
  for (const [bot, ua] of Object.entries(PROBE_AGENTS)) {
    botProbes.push(await probeBot(page.finalUrl, bot, ua));
  }

  // Soft-404s (HTML served for a .txt path) don't count.
  const plain = (p: PageSnapshot | null) =>
    p && !/^\s*<(!doctype|html)/i.test(p.html) ? p.html : null;
  const robotsTxt = plain(robotsPage);
  const robots = robotsTxt ? parseRobots(robotsTxt) : null;

  const sitemapCandidates = [...(robots?.sitemaps ?? []), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  let sitemapXml: string | null = null;
  let sitemapUrl: string | null = null;
  for (const candidate of sitemapCandidates) {
    const res = await tryFetch(candidate);
    if (res && /<(urlset|sitemapindex)[\s>]/i.test(res.html)) {
      sitemapXml = res.html;
      sitemapUrl = candidate;
      break;
    }
  }

  const $ = cheerio.load(page.html);
  const jsonLd: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      flattenJsonLd(JSON.parse($(el).text()), jsonLd);
    } catch {
      /* invalid JSON-LD is reported by the schema checks */
    }
  });
  const schemaTypes = [...new Set(jsonLd.flatMap(typesOf))];

  const body = $("body").clone();
  body.find("script, style, noscript, svg, template, iframe").remove();
  const text = body.text().replace(/\s+/g, " ").trim();

  return {
    page,
    origin,
    $,
    text,
    robotsTxt,
    robots,
    llmsTxt: plain(llmsPage),
    llmsFullTxt: plain(llmsFullPage),
    sitemapXml,
    sitemapUrl,
    jsonLd,
    schemaTypes,
    botProbes,
  };
}

type CheckInput = Omit<CheckResult, "score" | "impact" | "effort" | "weight"> &
  Partial<Pick<CheckResult, "score" | "impact" | "effort" | "weight">>;

/** Builds a CheckResult with sensible defaults (score derived from status). */
export function check(input: CheckInput): CheckResult {
  const defaultScore = { pass: 1, warn: 0.5, fail: 0, info: 1 }[input.status];
  return {
    impact: "medium",
    effort: "low",
    weight: 1,
    score: defaultScore,
    ...input,
    recommendation: input.status === "pass" || input.status === "info" ? undefined : input.recommendation,
  };
}
