import { check, type AuditContext } from "../context";
import type { CheckResult } from "../types";

const QUESTION_RE = /^(who|what|when|where|why|how|which|can|does|do|is|are|should|will)\b|\?$/i;

function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(groups?.length ?? 1, 1);
}

export function fleschReadingEase(text: string): number {
  const ws = words(text);
  const sentences = Math.max(text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0).length, 1);
  if (ws.length === 0) return 0;
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  return 206.835 - 1.015 * (ws.length / sentences) - 84.6 * (syl / ws.length);
}

export function contentChecks(ctx: AuditContext): CheckResult[] {
  const $ = ctx.$;
  const results: CheckResult[] = [];
  const wordCount = words(ctx.text).length;
  const scripts = $("script:not([type='application/ld+json'])").length;

  // 1. Is the content in the HTML, or rendered by JavaScript? Most AI crawlers don't execute JS.
  const csrShell = wordCount < 150 && ($("#root, #__next, #app, [data-reactroot]").length > 0 || scripts > 5);
  results.push(
    check({
      id: "server-rendered",
      category: "content",
      title: "Content is readable without JavaScript",
      status: csrShell ? "fail" : wordCount < 150 ? "warn" : "pass",
      detail: csrShell
        ? `Only ${wordCount} words are present in the raw HTML — the page looks client-side rendered.`
        : `${wordCount} words of text are present in the server-delivered HTML.`,
      recommendation:
        "GPTBot, ClaudeBot and PerplexityBot generally don't execute JavaScript. Server-render or pre-render your key content (SSR/SSG) so it's in the initial HTML.",
      impact: "high",
      effort: "high",
      weight: 4,
    }),
  );

  results.push(
    check({
      id: "content-depth",
      category: "content",
      title: "Enough substantive content to cite",
      status: wordCount >= 600 ? "pass" : wordCount >= 300 ? "warn" : "fail",
      score: Math.min(wordCount / 600, 1),
      detail: `${wordCount} words of visible text.`,
      recommendation:
        "Thin pages rarely get cited. Expand to 600+ words that fully answer what a buyer would ask: what you do, who it's for, how it works, pricing, proof and FAQs.",
      impact: "medium",
      effort: "medium",
      weight: 2,
    }),
  );

  const h1s = $("h1");
  results.push(
    check({
      id: "single-h1",
      category: "content",
      title: "One clear H1 headline",
      status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn",
      detail:
        h1s.length === 1
          ? `H1: "${h1s.first().text().replace(/\s+/g, " ").trim().slice(0, 120)}"`
          : h1s.length === 0
            ? "No H1 heading found."
            : `${h1s.length} H1 headings found — the page's main topic is ambiguous.`,
      recommendation: "Use exactly one H1 that states plainly what the page is about (e.g. \"Payroll software for small restaurants\").",
      impact: "medium",
      weight: 1.5,
    }),
  );

  const headings = $("h1, h2, h3, h4").toArray().map((el) => ({
    level: Number(el.tagName.slice(1)),
    text: $(el).text().replace(/\s+/g, " ").trim(),
  }));
  let skips = 0;
  headings.forEach((h, i) => {
    if (i > 0 && h.level > headings[i - 1].level + 1) skips++;
  });
  const h2count = headings.filter((h) => h.level === 2).length;
  results.push(
    check({
      id: "heading-structure",
      category: "content",
      title: "Logical heading hierarchy",
      status: h2count >= 2 && skips === 0 ? "pass" : h2count >= 1 ? "warn" : "fail",
      detail: `${h2count} H2 section(s), ${headings.length} headings total${skips ? `, ${skips} skipped level(s)` : ""}.`,
      recommendation:
        "Break content into clearly labelled H2/H3 sections without skipping levels. Answer engines extract passages section by section.",
      impact: "medium",
      weight: 1.5,
    }),
  );

  const questionHeadings = headings.filter((h) => QUESTION_RE.test(h.text));
  results.push(
    check({
      id: "question-headings",
      category: "content",
      title: "Headings phrased as the questions people ask",
      status: questionHeadings.length >= 3 ? "pass" : questionHeadings.length > 0 ? "warn" : "fail",
      score: Math.min(questionHeadings.length / 3, 1),
      detail: questionHeadings.length
        ? `${questionHeadings.length} question-style heading(s), e.g. "${questionHeadings[0].text.slice(0, 90)}".`
        : "No headings are phrased as questions.",
      evidence: questionHeadings.slice(0, 5).map((h) => h.text),
      recommendation:
        "Rephrase some headings as natural-language questions (\"How much does X cost?\", \"Who is X for?\") and answer each directly in the first sentence below it.",
      impact: "high",
      effort: "low",
      weight: 2.5,
    }),
  );

  const paragraphs = $("p")
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim())
    .filter((t) => words(t).length >= 8);
  const firstPara = paragraphs[0] ?? "";
  const firstLen = words(firstPara).length;
  const answerFirst = firstLen >= 15 && firstLen <= 90;
  results.push(
    check({
      id: "answer-first",
      category: "content",
      title: "Concise answer / summary near the top",
      status: answerFirst ? "pass" : firstPara ? "warn" : "fail",
      detail: firstPara
        ? `Opening paragraph is ${firstLen} words: "${firstPara.slice(0, 160)}${firstPara.length > 160 ? "…" : ""}"`
        : "No introductory paragraph found.",
      recommendation:
        "Open with a 40–60 word, self-contained summary that says who you are, what you offer and for whom. LLMs favour passages they can lift verbatim.",
      impact: "high",
      effort: "low",
      weight: 2.5,
    }),
  );

  const avgPara = paragraphs.length ? paragraphs.reduce((n, p) => n + words(p).length, 0) / paragraphs.length : 0;
  results.push(
    check({
      id: "paragraph-length",
      category: "content",
      title: "Short, scannable paragraphs",
      status: paragraphs.length === 0 ? "warn" : avgPara <= 80 ? "pass" : avgPara <= 120 ? "warn" : "fail",
      detail: paragraphs.length ? `Average paragraph length is ${Math.round(avgPara)} words across ${paragraphs.length} paragraphs.` : "No paragraphs found.",
      recommendation: "Keep paragraphs under ~80 words, one idea each, so they stand alone as quotable chunks.",
      impact: "low",
      weight: 1,
    }),
  );

  const lists = $("ul li, ol li").filter((_, el) => $(el).closest("nav, header, footer").length === 0).length;
  const tables = $("table").length;
  results.push(
    check({
      id: "lists-tables",
      category: "content",
      title: "Lists and tables for extractable facts",
      status: lists >= 3 || tables > 0 ? "pass" : "warn",
      detail: `${lists} content list item(s) and ${tables} table(s).`,
      recommendation: "Present features, steps, comparisons and pricing as bullet lists or tables — they are the formats most often reproduced in AI answers.",
      impact: "medium",
      weight: 1,
    }),
  );

  const stats = ctx.text.match(/\b\d[\d,.]*\s?(%|percent|x\b|\+|k\b|m\b|million|billion|customers|clients|years|users)/gi) ?? [];
  results.push(
    check({
      id: "statistics",
      category: "content",
      title: "Specific facts, numbers & statistics",
      status: stats.length >= 3 ? "pass" : stats.length > 0 ? "warn" : "fail",
      score: Math.min(stats.length / 3, 1),
      detail: stats.length ? `${stats.length} quantified claim(s), e.g. ${stats.slice(0, 4).join(", ")}.` : "No quantified claims found.",
      recommendation:
        "Add concrete, verifiable numbers (results, customers served, years in business, pricing). GEO research shows adding statistics measurably increases how often a source is cited.",
      impact: "medium",
      effort: "low",
      weight: 1.5,
    }),
  );

  const host = new URL(ctx.page.finalUrl).hostname.replace(/^www\./, "");
  const outbound = $("main a[href^='http'], article a[href^='http'], p a[href^='http']")
    .toArray()
    .map((el) => $(el).attr("href")!)
    .filter((href) => {
      try {
        return !new URL(href).hostname.endsWith(host);
      } catch {
        return false;
      }
    });
  const quotes = $("blockquote, q").length;
  results.push(
    check({
      id: "citations-quotes",
      category: "content",
      title: "Cites sources or expert quotes",
      status: outbound.length + quotes >= 2 ? "pass" : outbound.length + quotes > 0 ? "warn" : "fail",
      detail: `${outbound.length} in-content outbound reference link(s), ${quotes} quotation(s).`,
      recommendation:
        "Back key claims with links to reputable sources and include quotes from experts or customers. Citing sources and quotations are among the most effective GEO tactics.",
      impact: "medium",
      effort: "medium",
      weight: 1,
    }),
  );

  const fre = fleschReadingEase(paragraphs.join(" ") || ctx.text);
  results.push(
    check({
      id: "readability",
      category: "content",
      title: "Plain-language readability",
      status: fre >= 50 ? "pass" : fre >= 30 ? "warn" : "fail",
      score: Math.max(0, Math.min(fre / 50, 1)),
      detail: `Flesch reading ease ≈ ${Math.round(fre)} (60+ is plain English, below 30 is very difficult).`,
      recommendation: "Use shorter sentences and everyday words. Clear, direct language is easier for models to summarise accurately.",
      impact: "low",
      weight: 1,
    }),
  );

  const imgs = $("img");
  const withAlt = imgs.filter((_, el) => ($(el).attr("alt") ?? "").trim().length > 0).length;
  results.push(
    check({
      id: "image-alt",
      category: "content",
      title: "Images have descriptive alt text",
      status: imgs.length === 0 || withAlt / imgs.length >= 0.8 ? "pass" : withAlt / imgs.length >= 0.5 ? "warn" : "fail",
      score: imgs.length ? withAlt / imgs.length : 1,
      detail: imgs.length ? `${withAlt} of ${imgs.length} images have alt text.` : "No images on the page.",
      recommendation: "Add descriptive alt text to images so multimodal engines and crawlers understand them.",
      impact: "low",
      weight: 0.5,
    }),
  );

  return results;
}
