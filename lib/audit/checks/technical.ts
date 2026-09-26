import { check, type AuditContext } from "../context";
import type { CheckResult } from "../types";

export function technicalChecks(ctx: AuditContext): CheckResult[] {
  const $ = ctx.$;
  const results: CheckResult[] = [];
  const final = new URL(ctx.page.finalUrl);

  results.push(
    check({
      id: "https",
      category: "technical",
      title: "Served over HTTPS",
      status: final.protocol === "https:" ? "pass" : "fail",
      detail: final.protocol === "https:" ? "The page is served over HTTPS." : "The page is served over plain HTTP.",
      recommendation: "Serve every page over HTTPS and redirect HTTP → HTTPS.",
      impact: "high",
      weight: 2,
    }),
  );

  const title = $("title").first().text().trim();
  results.push(
    check({
      id: "title",
      category: "technical",
      title: "Descriptive <title> tag",
      status: title.length >= 20 && title.length <= 65 ? "pass" : title ? "warn" : "fail",
      detail: title ? `"${title}" (${title.length} characters).` : "No <title> tag.",
      recommendation: "Write a 30–65 character title that names the brand and the specific offering or question the page answers.",
      impact: "medium",
      weight: 1.5,
    }),
  );

  const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
  results.push(
    check({
      id: "meta-description",
      category: "technical",
      title: "Meta description summarises the page",
      status: description.length >= 70 && description.length <= 170 ? "pass" : description ? "warn" : "fail",
      detail: description ? `"${description.slice(0, 180)}" (${description.length} characters).` : "No meta description.",
      recommendation: "Add a 120–160 character meta description that answers \"what is this and who is it for?\" — AI search snippets often reuse it.",
      impact: "medium",
      weight: 1.5,
    }),
  );

  const canonical = $('link[rel="canonical"]').attr("href");
  results.push(
    check({
      id: "canonical",
      category: "technical",
      title: "Canonical URL declared",
      status: canonical ? "pass" : "warn",
      detail: canonical ? `Canonical: ${canonical}` : "No rel=canonical link.",
      recommendation: "Add <link rel=\"canonical\"> so engines consolidate signals on one URL instead of splitting them across duplicates.",
      impact: "low",
      weight: 1,
    }),
  );

  const lang = $("html").attr("lang");
  results.push(
    check({
      id: "lang",
      category: "technical",
      title: "Page language declared",
      status: lang ? "pass" : "warn",
      detail: lang ? `<html lang="${lang}">` : "No lang attribute on <html>.",
      recommendation: "Set <html lang=\"en\"> (or the right language) so engines serve your content to the right audience.",
      impact: "low",
      weight: 0.5,
    }),
  );

  const og = ["og:title", "og:description", "og:image"].filter((p) => $(`meta[property="${p}"]`).attr("content"));
  results.push(
    check({
      id: "open-graph",
      category: "technical",
      title: "Open Graph metadata",
      status: og.length === 3 ? "pass" : og.length > 0 ? "warn" : "fail",
      score: og.length / 3,
      detail: og.length ? `Present: ${og.join(", ")}.` : "No Open Graph tags.",
      recommendation: "Add og:title, og:description and og:image. Chat assistants use them to render link previews and summaries.",
      impact: "low",
      weight: 1,
    }),
  );

  const viewport = $('meta[name="viewport"]').attr("content");
  results.push(
    check({
      id: "viewport",
      category: "technical",
      title: "Mobile-friendly viewport",
      status: viewport ? "pass" : "warn",
      detail: viewport ? `viewport: ${viewport}` : "No viewport meta tag.",
      recommendation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
      impact: "low",
      weight: 0.5,
    }),
  );

  const ms = ctx.page.responseMs;
  results.push(
    check({
      id: "response-time",
      category: "technical",
      title: "Fast server response",
      status: ms <= 1500 ? "pass" : ms <= 3500 ? "warn" : "fail",
      score: ms <= 1500 ? 1 : Math.max(0, 1 - (ms - 1500) / 4000),
      detail: `HTML delivered in ${ms} ms.`,
      recommendation: "AI fetchers use short timeouts when answering live. Cache HTML at the edge/CDN and aim for < 1s time-to-first-byte.",
      impact: "medium",
      effort: "medium",
      weight: 1.5,
    }),
  );

  const kb = Math.round(ctx.page.bytes / 1024);
  results.push(
    check({
      id: "html-size",
      category: "technical",
      title: "Lean HTML payload",
      status: kb <= 500 ? "pass" : kb <= 1500 ? "warn" : "fail",
      detail: `HTML document is ${kb} KB.`,
      recommendation: "Trim inline scripts/styles. Very large HTML documents may be truncated by AI crawlers before they reach your content.",
      impact: "low",
      weight: 0.5,
    }),
  );

  return results;
}
