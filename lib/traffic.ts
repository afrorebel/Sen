import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { aiTraffic, brands, organizations } from "./db/schema";
import { hasFeature } from "./plans";

/** AI crawlers we recognise in server logs, by user-agent token. Order matters: specific before generic. */
export const AI_CRAWLERS: { name: string; owner: string; purpose: "search" | "user" | "training"; re: RegExp }[] = [
  { name: "OAI-SearchBot", owner: "OpenAI", purpose: "search", re: /OAI-SearchBot/i },
  { name: "ChatGPT-User", owner: "OpenAI", purpose: "user", re: /ChatGPT-User/i },
  { name: "GPTBot", owner: "OpenAI", purpose: "training", re: /GPTBot/i },
  { name: "Claude-SearchBot", owner: "Anthropic", purpose: "search", re: /Claude-SearchBot/i },
  { name: "Claude-User", owner: "Anthropic", purpose: "user", re: /Claude-User/i },
  { name: "ClaudeBot", owner: "Anthropic", purpose: "training", re: /ClaudeBot|anthropic-ai/i },
  { name: "Perplexity-User", owner: "Perplexity", purpose: "user", re: /Perplexity-User/i },
  { name: "PerplexityBot", owner: "Perplexity", purpose: "search", re: /PerplexityBot/i },
  { name: "Google-CloudVertexBot", owner: "Google", purpose: "user", re: /Google-CloudVertexBot/i },
  { name: "Gemini-Deep-Research", owner: "Google", purpose: "user", re: /Gemini-Deep-Research/i },
  { name: "Googlebot", owner: "Google", purpose: "search", re: /Googlebot/i },
  { name: "Bingbot", owner: "Microsoft", purpose: "search", re: /bingbot/i },
  { name: "Applebot", owner: "Apple", purpose: "search", re: /Applebot/i },
  { name: "Amazonbot", owner: "Amazon", purpose: "search", re: /Amazonbot/i },
  { name: "Meta-ExternalAgent", owner: "Meta", purpose: "training", re: /meta-externalagent|meta-externalfetcher|FacebookBot/i },
  { name: "DuckAssistBot", owner: "DuckDuckGo", purpose: "search", re: /DuckAssistBot/i },
  { name: "MistralAI-User", owner: "Mistral", purpose: "user", re: /MistralAI-User/i },
  { name: "Bytespider", owner: "ByteDance", purpose: "training", re: /Bytespider/i },
  { name: "CCBot", owner: "Common Crawl", purpose: "training", re: /CCBot/i },
  { name: "cohere-ai", owner: "Cohere", purpose: "training", re: /cohere-ai|cohere-training/i },
  { name: "YouBot", owner: "You.com", purpose: "search", re: /YouBot/i },
];

/** Assistants that send visitors, by referrer host or utm_source. */
export const AI_REFERRERS: { name: string; re: RegExp }[] = [
  { name: "ChatGPT", re: /(^|\.)(chatgpt\.com|chat\.openai\.com)$|^chatgpt(\.com)?$/i },
  { name: "Perplexity", re: /(^|\.)perplexity\.ai$|^perplexity$/i },
  { name: "Gemini", re: /(^|\.)gemini\.google\.com$|^gemini$|(^|\.)bard\.google\.com$/i },
  { name: "Claude", re: /(^|\.)claude\.ai$|^claude(\.ai)?$/i },
  { name: "Copilot", re: /(^|\.)copilot\.microsoft\.com$|^copilot$/i },
  { name: "DeepSeek", re: /(^|\.)chat\.deepseek\.com$/i },
  { name: "You.com", re: /(^|\.)you\.com$/i },
  { name: "Meta AI", re: /(^|\.)meta\.ai$/i },
];

export function crawlerFor(ua: string) {
  return AI_CRAWLERS.find((c) => c.re.test(ua)) ?? null;
}

export function assistantFor(referrerOrSource: string): string | null {
  let host = referrerOrSource.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(host)) host = new URL(host).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  return AI_REFERRERS.find((r) => r.re.test(host))?.name ?? null;
}

export interface LogEvent {
  ua: string;
  path: string;
  status: number;
  time: Date;
}

const COMBINED = /^\S+ \S+ \S+ \[([^\]]+)\] "(?:[A-Z]+ )?(\S+)[^"]*" (\d{3}) \S+(?: "[^"]*" "([^"]*)")?/;

function parseClfDate(s: string): Date {
  // 10/Oct/2026:13:55:36 +0000
  const m = s.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!m) return new Date(s);
  const mon = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2]) / 3;
  const tz = `${m[7].slice(0, 3)}:${m[7].slice(3)}`;
  return new Date(`${m[3]}-${String(mon + 1).padStart(2, "0")}-${m[1]}T${m[4]}:${m[5]}:${m[6]}${tz}`);
}

function cleanPath(raw: string): string {
  let p = raw;
  try {
    if (/^https?:\/\//.test(p)) p = new URL(p).pathname;
  } catch {
    /* keep raw */
  }
  // Never store query strings (they can carry personal data).
  return (p.split(/[?#]/)[0] || "/").slice(0, 300);
}

/** Parses Combined Log Format lines, JSON lines (Vercel, Cloudflare, Netlify drains) or a JSON array. */
export function parseLogs(text: string): LogEvent[] {
  const trimmed = text.trim();
  const out: LogEvent[] = [];
  const fromJson = (o: Record<string, unknown>) => {
    const req = (o.request ?? o.proxy ?? o.http ?? {}) as Record<string, unknown>;
    const ua = String(o.userAgent ?? o.user_agent ?? o.ua ?? o.ClientRequestUserAgent ?? req.userAgent ?? req.user_agent ?? (Array.isArray(req.userAgent) ? req.userAgent[0] : "") ?? "");
    const path = String(o.path ?? o.url ?? o.ClientRequestPath ?? o.ClientRequestURI ?? req.path ?? req.url ?? "/");
    const status = Number(o.status ?? o.statusCode ?? o.EdgeResponseStatus ?? req.statusCode ?? o.status_code ?? 200);
    const t = o.timestamp ?? o.time ?? o.date ?? o.EdgeStartTimestamp ?? Date.now();
    const time = new Date(typeof t === "number" && t < 1e12 ? t * 1000 : (t as string | number));
    if (ua) out.push({ ua, path: cleanPath(path), status: Number.isFinite(status) ? status : 200, time });
  };
  if (trimmed.startsWith("[")) {
    try {
      for (const o of JSON.parse(trimmed) as Record<string, unknown>[]) fromJson(o);
      return out;
    } catch {
      /* fall through to line parsing */
    }
  }
  for (const line of trimmed.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith("{")) {
      try {
        fromJson(JSON.parse(l));
      } catch {
        /* skip malformed line */
      }
      continue;
    }
    const m = l.match(COMBINED);
    if (m) out.push({ time: parseClfDate(m[1]), path: cleanPath(m[2]), status: Number(m[3]), ua: m[4] ?? "" });
  }
  return out;
}

type Row = { day: string; kind: "crawler" | "referral"; agent: string; path: string; hits: number; errors: number };

async function upsert(brandId: string, rows: Map<string, Row>) {
  for (const r of rows.values()) {
    await db
      .insert(aiTraffic)
      .values({ brandId, ...r })
      .onConflictDoUpdate({
        target: [aiTraffic.brandId, aiTraffic.day, aiTraffic.kind, aiTraffic.agent, aiTraffic.path],
        set: { hits: sql`${aiTraffic.hits} + ${r.hits}`, errors: sql`${aiTraffic.errors} + ${r.errors}` },
      });
  }
}

/** Keeps only AI crawler requests and adds them to the daily rollup. Returns how many were counted. */
export async function ingestLogs(brandId: string, events: LogEvent[]): Promise<{ counted: number; scanned: number }> {
  const rows = new Map<string, Row>();
  let counted = 0;
  for (const e of events) {
    const bot = crawlerFor(e.ua);
    if (!bot || Number.isNaN(e.time.getTime())) continue;
    counted++;
    const day = e.time.toISOString().slice(0, 10);
    const key = `${day}|${bot.name}|${e.path}`;
    const row = rows.get(key) ?? { day, kind: "crawler" as const, agent: bot.name, path: e.path, hits: 0, errors: 0 };
    row.hits++;
    if (e.status >= 400) row.errors++;
    rows.set(key, row);
  }
  await upsert(brandId, rows);
  return { counted, scanned: events.length };
}

export async function recordReferral(brandId: string, assistant: string, path: string) {
  const day = new Date().toISOString().slice(0, 10);
  const rows = new Map<string, Row>([["x", { day, kind: "referral", agent: assistant, path: cleanPath(path), hits: 1, errors: 0 }]]);
  await upsert(brandId, rows);
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** Finds a brand by its public snippet key (safe to expose in page source). */
export async function brandByTrafficToken(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const [b] = await db
    .select({ id: brands.id, plan: organizations.plan })
    .from(brands)
    .innerJoin(organizations, eq(organizations.id, brands.orgId))
    .where(eq(brands.trafficToken, token))
    .limit(1);
  // Keys stop counting if the workspace moves to a plan without AI Traffic.
  return b && hasFeature(b.plan, "traffic") ? { id: b.id } : null;
}

/** Finds a brand by its secret log-drain key. */
export async function brandByDrainToken(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const [b] = await db
    .select({ id: brands.id, plan: organizations.plan })
    .from(brands)
    .innerJoin(organizations, eq(organizations.id, brands.orgId))
    .where(eq(brands.trafficDrainToken, token))
    .limit(1);
  return b && hasFeature(b.plan, "traffic") ? { id: b.id } : null;
}

export const newTrafficToken = () => randomBytes(18).toString("base64url");

export interface TrafficSummary {
  days: string[];
  crawlerHits: number;
  crawlerErrors: number;
  referralVisits: number;
  byDay: { day: string; crawler: number; referral: number }[];
  crawlers: { name: string; owner: string; purpose: string; hits: number; errors: number }[];
  assistants: { name: string; visits: number }[];
  pages: { path: string; hits: number; bots: number }[];
  landing: { path: string; visits: number }[];
}

export async function trafficSummary(brandId: string, rangeDays: number): Promise<TrafficSummary> {
  const since = new Date(Date.now() - (rangeDays - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.select().from(aiTraffic).where(and(eq(aiTraffic.brandId, brandId), gte(aiTraffic.day, since)));
  const days: string[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));

  const sum = <K extends string>(list: typeof rows, key: (r: (typeof rows)[number]) => K) => {
    const m = new Map<K, { hits: number; errors: number; bots: Set<string> }>();
    for (const r of list) {
      const k = key(r);
      const e = m.get(k) ?? { hits: 0, errors: 0, bots: new Set<string>() };
      e.hits += r.hits;
      e.errors += r.errors;
      e.bots.add(r.agent);
      m.set(k, e);
    }
    return m;
  };
  const crawl = rows.filter((r) => r.kind === "crawler");
  const refs = rows.filter((r) => r.kind === "referral");
  const byCrawler = sum(crawl, (r) => r.agent);
  const byPage = sum(crawl, (r) => r.path);
  const byAssistant = sum(refs, (r) => r.agent);
  const byLanding = sum(refs, (r) => r.path);

  return {
    days,
    crawlerHits: crawl.reduce((n, r) => n + r.hits, 0),
    crawlerErrors: crawl.reduce((n, r) => n + r.errors, 0),
    referralVisits: refs.reduce((n, r) => n + r.hits, 0),
    byDay: days.map((day) => ({
      day,
      crawler: crawl.filter((r) => r.day === day).reduce((n, r) => n + r.hits, 0),
      referral: refs.filter((r) => r.day === day).reduce((n, r) => n + r.hits, 0),
    })),
    crawlers: [...byCrawler.entries()]
      .map(([name, v]) => {
        const meta = AI_CRAWLERS.find((c) => c.name === name);
        return { name, owner: meta?.owner ?? "", purpose: meta?.purpose ?? "", hits: v.hits, errors: v.errors };
      })
      .sort((a, b) => b.hits - a.hits),
    assistants: [...byAssistant.entries()].map(([name, v]) => ({ name, visits: v.hits })).sort((a, b) => b.visits - a.visits),
    pages: [...byPage.entries()].map(([path, v]) => ({ path, hits: v.hits, bots: v.bots.size })).sort((a, b) => b.hits - a.hits).slice(0, 12),
    landing: [...byLanding.entries()].map(([path, v]) => ({ path, visits: v.hits })).sort((a, b) => b.visits - a.visits).slice(0, 8),
  };
}
