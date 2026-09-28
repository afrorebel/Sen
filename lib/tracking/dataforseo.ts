import "server-only";
import type { Source } from "../db/schema";
import type { EngineId } from "./engines";

/**
 * Thin DataForSEO client for the endpoints AEOGrowthLeads uses to ask AI engines a prompt.
 * One account and one balance cover every API; auth is HTTP Basic with the API login/password.
 */

const BASE = process.env.DATAFORSEO_BASE_URL || "https://api.dataforseo.com";

export interface EngineAnswer {
  text: string;
  sources: Source[];
  /** Brands the engine itself labelled (ChatGPT scraper returns these). */
  brandEntities: string[];
  cost: number;
}

export interface AskOptions {
  prompt: string;
  locationCode: number;
  languageCode: string;
  countryIso: string;
  city?: string | null;
  /** Mock mode only: tracked names the fake answer may mention. */
  mockNames?: string[];
}

export class DataForSEOError extends Error {}

export function dataForSeoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

export function mockMode(): boolean {
  return process.env.DATAFORSEO_MOCK === "1" || !dataForSeoConfigured();
}

async function post(path: string, body: Record<string, unknown>): Promise<{ result: unknown; cost: number }> {
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify([body]),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) throw new DataForSEOError(`DataForSEO HTTP ${res.status} on ${path}`);
  const json = (await res.json()) as {
    status_code: number;
    status_message: string;
    tasks?: { status_code: number; status_message: string; cost?: number; result?: unknown[] }[];
  };
  if (json.status_code !== 20000) throw new DataForSEOError(`DataForSEO: ${json.status_message}`);
  const task = json.tasks?.[0];
  if (!task) throw new DataForSEOError("DataForSEO returned no task");
  if (task.status_code !== 20000) throw new DataForSEOError(`DataForSEO task: ${task.status_message}`);
  return { result: task.result?.[0] ?? null, cost: task.cost ?? 0 };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Collects every {url, domain?, title?} object in a response. The different endpoints nest
 * sources in different places (sources, references, annotations), so we walk the tree rather
 * than hard-coding each shape — this keeps working when DataForSEO adds item types.
 */
function collectSources(node: unknown, out: Map<string, Source>, depth = 0): void {
  if (depth > 12 || !node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectSources(n, out, depth + 1));
    return;
  }
  const obj = node as Record<string, unknown>;
  const url = typeof obj.url === "string" ? obj.url : null;
  if (url && /^https?:\/\//.test(url)) {
    const domain = (typeof obj.domain === "string" && obj.domain) || hostOf(url);
    // Skip Google's own navigation links inside AI Mode answers.
    if (domain && !/(^|\.)google\.[a-z.]+$/.test(domain.replace(/^www\./, "")) && !out.has(url)) {
      out.set(url, {
        url,
        domain: domain.replace(/^www\./, ""),
        title: typeof obj.title === "string" ? obj.title : typeof obj.source === "string" ? obj.source : undefined,
      });
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    // Brand entity links are the engine labelling a brand, not a source it read.
    if (key === "brand_entities") continue;
    if (key !== "url" && value && typeof value === "object") collectSources(value, out, depth + 1);
  }
}

function collectBrandEntities(node: unknown, out: Set<string>, depth = 0): void {
  if (depth > 12 || !node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectBrandEntities(n, out, depth + 1));
    return;
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.brand_entities)) {
    for (const b of obj.brand_entities as Record<string, unknown>[]) {
      const name = b?.title ?? b?.name;
      if (typeof name === "string" && name.trim()) out.add(name.trim());
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") collectBrandEntities(value, out, depth + 1);
  }
}

function markdownOf(result: Record<string, unknown> | null): string {
  if (!result) return "";
  if (typeof result.markdown === "string" && result.markdown.trim()) return result.markdown;
  const items = (result.items as Record<string, unknown>[] | undefined) ?? [];
  const parts: string[] = [];
  for (const item of items) {
    if (typeof item.markdown === "string") parts.push(item.markdown);
    else if (typeof item.text === "string") parts.push(item.text);
    for (const section of (item.sections as Record<string, unknown>[] | undefined) ?? []) {
      if (typeof section.text === "string" && section.type !== "summary_text") parts.push(section.text);
    }
  }
  return parts.join("\n\n");
}

export function toAnswer(result: unknown, cost: number): EngineAnswer {
  const r = (result ?? null) as Record<string, unknown> | null;
  const sources = new Map<string, Source>();
  collectSources(r, sources);
  const entities = new Set<string>();
  collectBrandEntities(r, entities);
  return { text: markdownOf(r), sources: [...sources.values()], brandEntities: [...entities], cost };
}

/** Ask one engine one prompt. */
export async function askEngine(engine: EngineId, opts: AskOptions): Promise<EngineAnswer> {
  if (mockMode()) return mockAnswer(engine, opts);

  const geo = { location_code: opts.locationCode, language_code: opts.languageCode };
  switch (engine) {
    case "chatgpt": {
      const { result, cost } = await post("/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced", {
        ...geo,
        keyword: opts.prompt,
        force_web_search: true,
      });
      return toAnswer(result, cost);
    }
    case "gemini": {
      const { result, cost } = await post("/v3/ai_optimization/gemini/llm_scraper/live/advanced", {
        ...geo,
        keyword: opts.prompt,
      });
      return toAnswer(result, cost);
    }
    case "google_ai_mode": {
      const { result, cost } = await post("/v3/serp/google/ai_mode/live/advanced", {
        ...geo,
        keyword: opts.prompt,
      });
      return toAnswer(result, cost);
    }
    case "perplexity": {
      const { result, cost } = await post("/v3/ai_optimization/perplexity/llm_responses/live", {
        user_prompt: opts.prompt.slice(0, 500),
        model_name: process.env.DATAFORSEO_PERPLEXITY_MODEL || "sonar",
        web_search_country_iso_code: opts.countryIso,
      });
      return toAnswer(result, cost);
    }
    case "claude": {
      const { result, cost } = await post("/v3/ai_optimization/claude/llm_responses/live", {
        user_prompt: opts.prompt.slice(0, 500),
        model_name: process.env.DATAFORSEO_CLAUDE_MODEL || "claude-sonnet-4-0",
        web_search: true,
        force_web_search: true,
        web_search_country_iso_code: opts.countryIso,
        ...(opts.city ? { web_search_city: opts.city } : {}),
      });
      return toAnswer(result, cost);
    }
  }
}

// ---------------------------------------------------------------------------
// Mock mode: deterministic fake answers so the app can be developed and demoed
// before DataForSEO credentials are connected. Enabled when no credentials are set.
// ---------------------------------------------------------------------------

function seeded(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function mockAnswer(engine: EngineId, opts: AskOptions): EngineAnswer {
  const mockBrands = opts.mockNames ?? [];
  const rand = seeded(`${engine}|${opts.prompt}|${new Date().toISOString().slice(0, 10)}`);
  const pool = [...mockBrands.filter((b) => !b.includes(".")), "BrightPath Co", "Summit Partners", "Northwind Group"];
  const picks = pool.filter(() => rand() < 0.45).slice(0, 4);
  const lines = picks.map((b, i) => `${i + 1}. **${b}** — frequently recommended for this need, with strong reviews.`);
  const sources: Source[] = [
    { url: "https://www.reddit.com/r/smallbusiness/comments/abc/which_provider/", domain: "reddit.com", title: "Which provider did you pick?" },
    { url: "https://www.yelp.com/search?find_desc=providers", domain: "yelp.com", title: "Top providers" },
    { url: "https://en.wikipedia.org/wiki/Service", domain: "en.wikipedia.org", title: "Service" },
  ].filter(() => rand() < 0.7);
  if (mockBrands[0] && rand() < 0.35) {
    const domain = mockBrands.find((b) => b.includes(".")) ?? "example.com";
    sources.push({ url: `https://${domain}/`, domain, title: "Official site" });
  }
  return {
    text: `Here are some options for "${opts.prompt}":\n\n${lines.join("\n") || "No specific providers stood out."}`,
    sources,
    brandEntities: picks,
    cost: 0,
  };
}
