import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { checks, prompts, runs, type Check, type Run } from "../db/schema";
import { ENGINES, isEngine, type EngineId } from "./engines";

export interface RunSummary {
  run: Run;
  checks: number;
  mentionRate: number;
  citationRate: number;
  /** Own mentions ÷ all brand mentions across answers. */
  shareOfVoice: number;
  avgPosition: number | null;
}

export interface EngineSummary {
  engine: EngineId;
  label: string;
  checks: number;
  mentionRate: number;
  citationRate: number;
  avgPosition: number | null;
}

export interface BrandVisibility {
  latest: RunSummary | null;
  previous: RunSummary | null;
  trend: RunSummary[];
  engines: EngineSummary[];
  competitors: { name: string; mentions: number; share: number; isOwn: boolean }[];
  sources: { domain: string; citations: number; sample: string; title?: string }[];
  prompts: {
    id: string;
    text: string;
    intent: string;
    results: Partial<Record<EngineId, Pick<Check, "mentioned" | "position" | "cited" | "status" | "id">>>;
  }[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function summarize(run: Run, rows: Check[]): RunSummary {
  const done = rows.filter((c) => c.status === "done");
  const allMentions = done.reduce((n, c) => n + (c.brandsFound?.length ?? 0), 0);
  const own = done.filter((c) => c.mentioned).length;
  return {
    run,
    checks: done.length,
    mentionRate: done.length ? own / done.length : 0,
    citationRate: done.length ? done.filter((c) => c.cited).length / done.length : 0,
    shareOfVoice: allMentions ? own / allMentions : 0,
    avgPosition: avg(done.filter((c) => c.position).map((c) => c.position!)),
  };
}

export async function brandVisibility(brandId: string, trendRuns = 12): Promise<BrandVisibility> {
  const recent = await db
    .select()
    .from(runs)
    .where(eq(runs.brandId, brandId))
    .orderBy(desc(runs.startedAt))
    .limit(trendRuns);
  const promptRows = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.brandId, brandId), eq(prompts.active, true)))
    .orderBy(prompts.createdAt);

  if (!recent.length) {
    return {
      latest: null,
      previous: null,
      trend: [],
      engines: [],
      competitors: [],
      sources: [],
      prompts: promptRows.map((p) => ({ id: p.id, text: p.text, intent: p.intent, results: {} })),
    };
  }

  const checkRows = await db.select().from(checks).where(inArray(checks.runId, recent.map((r) => r.id)));
  const byRun = new Map<string, Check[]>();
  for (const c of checkRows) byRun.set(c.runId, [...(byRun.get(c.runId) ?? []), c]);

  const trend = recent.map((r) => summarize(r, byRun.get(r.id) ?? [])).reverse();
  // The dashboard reports on the newest run that has results; a run in progress shows as progress.
  const withData = [...trend].reverse().filter((t) => t.checks > 0);
  const latest = withData[0] ?? null;
  const previous = withData[1] ?? null;
  const latestChecks = latest ? (byRun.get(latest.run.id) ?? []).filter((c) => c.status === "done") : [];

  const engines: EngineSummary[] = [];
  for (const id of Object.keys(ENGINES) as EngineId[]) {
    const rows = latestChecks.filter((c) => c.engine === id);
    if (!rows.length) continue;
    engines.push({
      engine: id,
      label: ENGINES[id].label,
      checks: rows.length,
      mentionRate: rows.filter((c) => c.mentioned).length / rows.length,
      citationRate: rows.filter((c) => c.cited).length / rows.length,
      avgPosition: avg(rows.filter((c) => c.position).map((c) => c.position!)),
    });
  }

  const counts = new Map<string, { mentions: number; isOwn: boolean }>();
  let total = 0;
  for (const c of latestChecks) {
    for (const b of c.brandsFound ?? []) {
      const entry = counts.get(b.name) ?? { mentions: 0, isOwn: b.isOwn };
      entry.mentions++;
      counts.set(b.name, entry);
      total++;
    }
  }
  const competitors = [...counts.entries()]
    .map(([name, v]) => ({ name, mentions: v.mentions, isOwn: v.isOwn, share: total ? v.mentions / total : 0 }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 12);

  const sourceCounts = new Map<string, { citations: number; sample: string; title?: string }>();
  for (const c of latestChecks) {
    const seen = new Set<string>();
    for (const s of c.sources ?? []) {
      if (seen.has(s.domain)) continue;
      seen.add(s.domain);
      const entry = sourceCounts.get(s.domain) ?? { citations: 0, sample: s.url, title: s.title };
      entry.citations++;
      sourceCounts.set(s.domain, entry);
    }
  }
  const sources = [...sourceCounts.entries()]
    .map(([domain, v]) => ({ domain, ...v }))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 15);

  // Latest known result per prompt × engine, looking back through runs so a
  // prompt added mid-cycle still shows its most recent answer.
  const latestByKey = new Map<string, Check>();
  for (const r of [...trend].reverse()) {
    for (const c of byRun.get(r.run.id) ?? []) {
      const key = `${c.promptId}|${c.engine}`;
      if (!latestByKey.has(key) && (c.status === "done" || r.run.status === "running")) latestByKey.set(key, c);
    }
  }
  const promptResults = promptRows.map((p) => {
    const results: BrandVisibility["prompts"][number]["results"] = {};
    for (const id of Object.keys(ENGINES)) {
      const c = latestByKey.get(`${p.id}|${id}`);
      if (c && isEngine(id)) {
        results[id] = { id: c.id, mentioned: c.mentioned, position: c.position, cited: c.cited, status: c.status };
      }
    }
    return { id: p.id, text: p.text, intent: p.intent, results };
  });

  return { latest, previous, trend, engines, competitors, sources, prompts: promptResults };
}
