import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { VisibilityPrompt, VisibilityResult } from "./types";

const MODEL = process.env.AEO_VISIBILITY_MODEL || "claude-opus-5";
// Opt into server-side refusal fallbacks: a declined request is retried on Anthropic's recommended model.
const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: Anthropic.Beta.BetaFallbacksParam } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export function visibilityEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export interface SiteSummary {
  brand: string;
  domain: string;
  title: string;
  description: string;
  h1: string;
  excerpt: string;
}

const PromptPlan = z.object({
  category: z.string().describe("Short description of the business category, e.g. 'B2B marketing agency'"),
  location: z.string().describe("City/region the business serves, or 'global'"),
  prompts: z
    .array(z.string())
    .describe("Realistic questions a prospective customer would ask an AI assistant. Never include the brand name."),
});

const Mentions = z.object({
  answers: z.array(
    z.object({
      index: z.number().int(),
      brands: z
        .array(z.string())
        .describe("Companies, products or services recommended or named in the answer, in the order they first appear"),
    }),
  ),
});

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function planPrompts(client: Anthropic, site: SiteSummary, count: number) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { format: zodOutputFormat(PromptPlan) },
    messages: [
      {
        role: "user",
        content: `You are helping audit how visible a business is in AI assistants (ChatGPT, Claude, Perplexity, Gemini).

Here is the business's homepage:
<site>
Domain: ${site.domain}
Brand: ${site.brand}
Title: ${site.title}
Meta description: ${site.description}
H1: ${site.h1}
Excerpt: ${site.excerpt.slice(0, 2500)}
</site>

Write exactly ${count} distinct questions a prospective customer who has never heard of this brand might type into an AI assistant, where this business would be a genuinely relevant answer. Mix intents: "best X for Y" recommendations, "how do I solve <problem>", comparisons of options, and location-specific queries if the business is local. Do not mention the brand or domain in any question.`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Could not generate test prompts for this site");
  }
  return response.parsed_output;
}

async function askWithSearch(client: Anthropic, prompt: string) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  let text = "";
  const citedUrls = new Set<string>();
  const retrievedUrls = new Set<string>();

  // Server-side web search can pause long turns; resume a few times if so.
  for (let i = 0; i < 4; i++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: "low" },
      system:
        "You are a helpful AI assistant answering a user's question. Search the web, then give a direct, practical answer. When the user is looking for a product, service or provider, recommend specific named options.",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages,
    });
    if (response.stop_reason === "refusal") break;

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
        for (const c of block.citations ?? []) {
          if ("url" in c && c.url) citedUrls.add(c.url);
        }
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) retrievedUrls.add(r.url);
      }
    }
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  return { text, citedUrls: [...citedUrls], retrievedUrls: [...retrievedUrls] };
}

async function extractMentions(client: Anthropic, answers: string[]) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: zodOutputFormat(Mentions) },
    messages: [
      {
        role: "user",
        content: `For each numbered AI answer below, list the companies, brands, products or service providers it names or recommends, in order of first appearance. Exclude generic platforms that are only mentioned as sources (e.g. "Reddit", "Wikipedia") unless they are recommended as a solution.

${answers.map((a, i) => `<answer index="${i}">\n${a.slice(0, 6000)}\n</answer>`).join("\n\n")}`,
      },
    ],
  });
  return response.parsed_output?.answers ?? [];
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function runVisibilityProbe(site: SiteSummary, promptCount = 5): Promise<VisibilityResult> {
  const client = new Anthropic();
  const base: VisibilityResult = {
    engine: "Claude + web search",
    model: MODEL,
    prompts: [],
    mentionRate: 0,
    citationRate: 0,
    shareOfVoice: 0,
    topCompetitors: [],
  };

  try {
    const plan = await planPrompts(client, site, promptCount);
    const prompts = plan.prompts.slice(0, promptCount);
    const answers = await Promise.all(prompts.map((p) => askWithSearch(client, p)));
    const mentions = await extractMentions(
      client,
      answers.map((a) => a.text),
    );

    const domainRoot = site.domain.replace(/^www\./, "").split(".")[0];
    const brandRe = new RegExp(
      `\\b(${[site.brand, domainRoot, site.domain.replace(/^www\./, "")].filter((s) => s.length > 2).map(escapeRegex).join("|")})\\b`,
      "i",
    );
    const isBrand = (name: string) => brandRe.test(name) || name.toLowerCase().includes(domainRoot.toLowerCase());
    const onDomain = (u: string) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "").endsWith(site.domain.replace(/^www\./, ""));
      } catch {
        return false;
      }
    };

    const competitorCounts = new Map<string, number>();
    let brandMentions = 0;
    let totalMentions = 0;

    const results: VisibilityPrompt[] = prompts.map((prompt, i) => {
      const answer = answers[i];
      const brands = mentions.find((m) => m.index === i)?.brands ?? [];
      const brandIdx = brands.findIndex(isBrand);
      const mentioned = brandIdx >= 0 || brandRe.test(answer.text);
      const cited = answer.citedUrls.some(onDomain) || answer.retrievedUrls.some(onDomain);
      const competitors = brands.filter((b) => !isBrand(b));
      competitors.forEach((c) => competitorCounts.set(c, (competitorCounts.get(c) ?? 0) + 1));
      totalMentions += brands.length || (mentioned ? 1 : 0);
      if (mentioned) brandMentions++;

      const sentence =
        answer.text.split(/(?<=[.!?])\s+/).find((s) => brandRe.test(s)) ?? answer.text.slice(0, 280);
      return {
        prompt,
        mentioned,
        cited,
        position: brandIdx >= 0 ? brandIdx + 1 : null,
        competitors: competitors.slice(0, 8),
        excerpt: sentence.trim().slice(0, 400),
      };
    });

    return {
      ...base,
      prompts: results,
      mentionRate: results.filter((r) => r.mentioned).length / Math.max(results.length, 1),
      citationRate: results.filter((r) => r.cited).length / Math.max(results.length, 1),
      shareOfVoice: totalMentions ? brandMentions / totalMentions : 0,
      topCompetitors: [...competitorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, mentions]) => ({ name, mentions })),
    };
  } catch (err) {
    let message = err instanceof Error ? err.message : String(err);
    if (err instanceof Anthropic.AuthenticationError) message = "Invalid ANTHROPIC_API_KEY";
    else if (err instanceof Anthropic.RateLimitError) message = "Rate limited by the Anthropic API — try again shortly";
    else if (err instanceof Anthropic.APIError) message = `Anthropic API error ${err.status}: ${err.message}`;
    return { ...base, error: message };
  }
}
