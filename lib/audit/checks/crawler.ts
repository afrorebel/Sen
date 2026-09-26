import { check, type AuditContext } from "../context";
import { isAllowed } from "../robots";
import type { CheckResult, CrawlerAccess } from "../types";

export const AI_BOTS: Omit<CrawlerAccess, "allowed" | "rule">[] = [
  { bot: "OAI-SearchBot", owner: "OpenAI (ChatGPT Search)", purpose: "search" },
  { bot: "ChatGPT-User", owner: "OpenAI (ChatGPT browsing)", purpose: "user-fetch" },
  { bot: "GPTBot", owner: "OpenAI (model training)", purpose: "training" },
  { bot: "Claude-SearchBot", owner: "Anthropic (Claude search)", purpose: "search" },
  { bot: "Claude-User", owner: "Anthropic (Claude browsing)", purpose: "user-fetch" },
  { bot: "ClaudeBot", owner: "Anthropic (model training)", purpose: "training" },
  { bot: "PerplexityBot", owner: "Perplexity (search index)", purpose: "search" },
  { bot: "Perplexity-User", owner: "Perplexity (browsing)", purpose: "user-fetch" },
  { bot: "Googlebot", owner: "Google (Search, AI Overviews, AI Mode)", purpose: "search" },
  { bot: "Google-Extended", owner: "Google (Gemini training/grounding)", purpose: "training" },
  { bot: "Bingbot", owner: "Microsoft (Bing, Copilot)", purpose: "search" },
  { bot: "Applebot-Extended", owner: "Apple (Apple Intelligence)", purpose: "training" },
  { bot: "Meta-ExternalAgent", owner: "Meta (Meta AI)", purpose: "training" },
  { bot: "Amazonbot", owner: "Amazon (Alexa, Rufus)", purpose: "search" },
  { bot: "DuckAssistBot", owner: "DuckDuckGo (DuckAssist)", purpose: "search" },
  { bot: "CCBot", owner: "Common Crawl (open dataset)", purpose: "training" },
];

export function crawlerAccess(ctx: AuditContext): CrawlerAccess[] {
  return AI_BOTS.map((b) => {
    if (!ctx.robots) return { ...b, allowed: true };
    const path = new URL(ctx.page.finalUrl).pathname || "/";
    return { ...b, ...isAllowed(ctx.robots, b.bot, path) };
  });
}

export function crawlerChecks(ctx: AuditContext, access: CrawlerAccess[]): CheckResult[] {
  const results: CheckResult[] = [];

  results.push(
    ctx.robotsTxt
      ? check({
          id: "robots-present",
          category: "crawler",
          title: "robots.txt is published",
          status: "pass",
          detail: `Found robots.txt with ${ctx.robots?.groups.length ?? 0} user-agent group(s).`,
          weight: 1,
        })
      : check({
          id: "robots-present",
          category: "crawler",
          title: "robots.txt is published",
          status: "warn",
          detail: "No robots.txt found. Crawlers will assume full access, but you have no way to signal intent to AI bots.",
          recommendation: "Publish /robots.txt that explicitly allows the AI search bots you want citing you and links your sitemap.",
          weight: 1,
        }),
  );

  const answerBots = access.filter((a) => a.purpose !== "training");
  const blockedAnswer = answerBots.filter((a) => !a.allowed);
  results.push(
    check({
      id: "ai-search-bots-allowed",
      category: "crawler",
      title: "AI search & answer bots can crawl the site",
      status: blockedAnswer.length === 0 ? "pass" : blockedAnswer.length <= 2 ? "warn" : "fail",
      score: 1 - blockedAnswer.length / answerBots.length,
      detail:
        blockedAnswer.length === 0
          ? `All ${answerBots.length} AI search / user-fetch bots are allowed by robots.txt.`
          : `${blockedAnswer.length} of ${answerBots.length} answer-engine bots are blocked: ${blockedAnswer.map((b) => b.bot).join(", ")}.`,
      recommendation:
        "Remove the Disallow rules for these bots. They fetch pages in real time to answer questions and cite sources — blocking them makes you invisible in ChatGPT Search, Claude, Perplexity and Copilot answers.",
      evidence: blockedAnswer.map((b) => b.rule ?? b.bot),
      impact: "high",
      effort: "low",
      weight: 4,
    }),
  );

  const trainingBots = access.filter((a) => a.purpose === "training");
  const blockedTraining = trainingBots.filter((a) => !a.allowed);
  results.push(
    check({
      id: "ai-training-bots",
      category: "crawler",
      title: "AI training crawlers policy",
      status: blockedTraining.length === 0 ? "pass" : blockedTraining.length === trainingBots.length ? "warn" : "info",
      detail:
        blockedTraining.length === 0
          ? "Training crawlers (GPTBot, ClaudeBot, Google-Extended, …) are allowed, so your brand can be learned by future models."
          : `Blocked training crawlers: ${blockedTraining.map((b) => b.bot).join(", ")}. This is a valid business choice but reduces how well models know your brand without live search.`,
      recommendation:
        "Consider allowing training crawlers for your public marketing pages so models learn your brand, products and positioning.",
      evidence: blockedTraining.map((b) => b.rule ?? b.bot),
      impact: "medium",
      effort: "low",
      weight: 2,
    }),
  );

  const blockedProbes = ctx.botProbes.filter((p) => p.blocked);
  results.push(
    check({
      id: "firewall-bot-blocking",
      category: "crawler",
      title: "CDN / firewall doesn't block AI user agents",
      status: blockedProbes.length === 0 ? "pass" : "fail",
      score: 1 - blockedProbes.length / Math.max(ctx.botProbes.length, 1),
      detail:
        blockedProbes.length === 0
          ? `Requests with ${ctx.botProbes.map((p) => p.bot).join(", ")} user agents were served normally.`
          : `Requests as ${blockedProbes.map((p) => `${p.bot} (${p.status ?? "no response"})`).join(", ")} were rejected even though a browser request succeeded.`,
      recommendation:
        "Your CDN or WAF (e.g. Cloudflare's \"Block AI bots\" setting) is rejecting AI crawlers. Allow-list verified AI search bots in the firewall rules.",
      evidence: ctx.botProbes.map((p) => `${p.bot}: HTTP ${p.status ?? "error"}`),
      impact: "high",
      effort: "low",
      weight: 3,
    }),
  );

  const $ = ctx.$;
  const metaRobots = [
    $('meta[name="robots"]').attr("content") ?? "",
    ...AI_BOTS.map((b) => $(`meta[name="${b.bot.toLowerCase()}"]`).attr("content") ?? ""),
    ctx.page.headers["x-robots-tag"] ?? "",
  ]
    .join(",")
    .toLowerCase();
  const directives = ["noindex", "nosnippet", "noai", "noimageai", "max-snippet:0"].filter((d) =>
    metaRobots.includes(d),
  );
  results.push(
    check({
      id: "meta-robots",
      category: "crawler",
      title: "No noindex / nosnippet / noai directives",
      status: directives.length === 0 ? "pass" : directives.some((d) => d === "noindex" || d === "nosnippet") ? "fail" : "warn",
      detail:
        directives.length === 0
          ? "Meta robots and X-Robots-Tag allow indexing and snippets."
          : `Restrictive directives found: ${directives.join(", ")}.`,
      recommendation:
        "Remove noindex/nosnippet/noai from pages you want AI engines to quote. nosnippet and max-snippet:0 stop Google AI Overviews from using your text.",
      impact: "high",
      effort: "low",
      weight: 3,
    }),
  );

  results.push(
    ctx.sitemapXml
      ? check({
          id: "sitemap",
          category: "crawler",
          title: "XML sitemap is discoverable",
          status: "pass",
          detail: `Sitemap found at ${ctx.sitemapUrl} with ${(ctx.sitemapXml.match(/<loc>/g) ?? []).length} entries.`,
          weight: 1,
        })
      : check({
          id: "sitemap",
          category: "crawler",
          title: "XML sitemap is discoverable",
          status: "fail",
          detail: "No XML sitemap found at /sitemap.xml or in robots.txt.",
          recommendation: "Generate an XML sitemap with <lastmod> dates and reference it from robots.txt (Sitemap: https://…/sitemap.xml).",
          impact: "medium",
          weight: 1.5,
        }),
  );

  const lastmods = ctx.sitemapXml?.match(/<lastmod>/g)?.length ?? 0;
  if (ctx.sitemapXml) {
    results.push(
      check({
        id: "sitemap-lastmod",
        category: "crawler",
        title: "Sitemap includes <lastmod> freshness dates",
        status: lastmods > 0 ? "pass" : "warn",
        detail: lastmods > 0 ? `${lastmods} entries carry <lastmod>.` : "Sitemap entries have no <lastmod> dates.",
        recommendation: "Add accurate <lastmod> dates so AI search indexes (Bing/Copilot, ChatGPT Search) re-crawl updated content quickly.",
        impact: "low",
        weight: 0.5,
      }),
    );
  }

  const llms = ctx.llmsTxt;
  results.push(
    llms
      ? check({
          id: "llms-txt",
          category: "crawler",
          title: "llms.txt guide for AI agents",
          status: /^#\s+\S/m.test(llms) ? "pass" : "warn",
          detail: /^#\s+\S/m.test(llms)
            ? `llms.txt found (${llms.split(/\n/).length} lines)${ctx.llmsFullTxt ? " plus llms-full.txt" : ""}.`
            : "llms.txt exists but doesn't follow the spec (should start with an H1 title, a > summary and link lists).",
          recommendation: "Format llms.txt per llmstxt.org: an H1 with your name, a blockquote summary, then sections of markdown links to key pages.",
          impact: "low",
          weight: 1,
        })
      : check({
          id: "llms-txt",
          category: "crawler",
          title: "llms.txt guide for AI agents",
          status: "warn",
          detail: "No /llms.txt found.",
          recommendation:
            "Add /llms.txt — a markdown file summarising who you are and linking your most important pages. It is an emerging convention that AI agents and IDE assistants read.",
          impact: "low",
          effort: "low",
          weight: 1,
        }),
  );

  return results;
}
