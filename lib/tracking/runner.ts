import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { brands, checks, organizations, prompts, runs, type Brand } from "../db/schema";
import { planFor } from "../plans";
import { analyzeAnswer } from "./analyze";
import { askEngine } from "./dataforseo";
import { isEngine } from "./engines";

const MAX_ATTEMPTS = 3;
const CONCURRENCY = Number(process.env.TRACKING_CONCURRENCY ?? 6);

function nextRunFrom(brand: Pick<Brand, "frequency">, from = new Date()) {
  const days = brand.frequency === "daily" ? 1 : 7;
  return new Date(from.getTime() + days * 86_400_000);
}

/** Creates a run with one pending check per active prompt × engine. */
export async function startRun(brandId: string, trigger: "schedule" | "manual" = "manual") {
  return db.transaction(async (tx) => {
    const [brand] = await tx.select().from(brands).where(eq(brands.id, brandId)).for("update");
    if (!brand) throw new Error("Brand not found");
    const [active] = await tx
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.brandId, brandId), eq(runs.status, "running")))
      .limit(1);
    if (active) return { runId: active.id, created: false };

    // Enforce the current plan at run time too, so a downgrade stops over-limit usage.
    const [org] = await tx.select({ plan: organizations.plan }).from(organizations).where(eq(organizations.id, brand.orgId));
    const plan = planFor(org?.plan ?? "free");
    const activePrompts = await tx
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.brandId, brandId), eq(prompts.active, true)))
      .orderBy(prompts.createdAt)
      .limit(plan.prompts);
    const engines = brand.engines.filter(isEngine).slice(0, plan.engineSlots);
    if (brand.frequency === "daily" && !plan.frequencies.includes("daily")) brand.frequency = "weekly";
    const total = activePrompts.length * engines.length;

    await tx.update(brands).set({ nextRunAt: nextRunFrom(brand) }).where(eq(brands.id, brandId));
    if (total === 0) return { runId: null, created: false };

    const [run] = await tx.insert(runs).values({ brandId, trigger, checksTotal: total }).returning({ id: runs.id });
    await tx.insert(checks).values(
      activePrompts.flatMap((p) => engines.map((engine) => ({ runId: run.id, brandId, promptId: p.id, engine }))),
    );
    return { runId: run.id, created: true };
  });
}

/** Starts runs for every brand whose schedule is due. */
export async function scheduleDueRuns(): Promise<number> {
  const due = await db
    .select({ id: brands.id })
    .from(brands)
    .where(lte(brands.nextRunAt, new Date()))
    .limit(50);
  let started = 0;
  for (const b of due) {
    const res = await startRun(b.id, "schedule");
    if (res.created) started++;
  }
  return started;
}

/** Atomically claims pending checks so several cron ticks never process the same one. */
async function claimChecks(limit: number) {
  // Recover checks stuck in "processing" (e.g. the process was killed mid-request).
  await db.execute(sql`
    UPDATE checks SET status = 'pending'
    WHERE status = 'processing' AND created_at < now() - interval '15 minutes' AND attempts < ${MAX_ATTEMPTS}
  `);
  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE checks SET status = 'processing', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM checks WHERE status = 'pending'
      ORDER BY created_at LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const ids = claimed.rows.map((r) => r.id);
  if (!ids.length) return [];
  return db
    .select({ check: checks, prompt: prompts, brand: brands })
    .from(checks)
    .innerJoin(prompts, eq(prompts.id, checks.promptId))
    .innerJoin(brands, eq(brands.id, checks.brandId))
    .where(inArray(checks.id, ids));
}

type Claimed = Awaited<ReturnType<typeof claimChecks>>[number];

async function processOne({ check, prompt, brand }: Claimed) {
  if (!isEngine(check.engine)) {
    await finish(check.id, check.runId, { status: "error", error: `Unknown engine ${check.engine}` });
    return;
  }
  try {
    const answer = await askEngine(check.engine, {
      prompt: prompt.text,
      locationCode: brand.locationCode,
      languageCode: brand.languageCode,
      countryIso: brand.countryIso,
      city: brand.city,
      mockNames: [brand.name, brand.domain, ...brand.competitors.map((c) => c.name)],
    });
    const analysis = analyzeAnswer(brand, answer);
    await finish(check.id, check.runId, {
      status: "done",
      mentioned: analysis.mentioned,
      position: analysis.position,
      cited: analysis.cited,
      brandsFound: analysis.brandsFound,
      answer: answer.text.slice(0, 20_000),
      sources: answer.sources.slice(0, 50),
      cost: answer.cost,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (check.attempts < MAX_ATTEMPTS) {
      await db.update(checks).set({ status: "pending", error: message }).where(eq(checks.id, check.id));
    } else {
      await finish(check.id, check.runId, { status: "error", error: message });
    }
  }
}

async function finish(
  checkId: string,
  runId: string,
  values: Partial<typeof checks.$inferInsert> & { status: "done" | "error" },
) {
  await db.transaction(async (tx) => {
    await tx.update(checks).set({ ...values, completedAt: new Date() }).where(eq(checks.id, checkId));
    await tx
      .update(runs)
      .set({
        checksDone: sql`${runs.checksDone} + 1`,
        cost: sql`${runs.cost} + ${values.cost ?? 0}`,
      })
      .where(eq(runs.id, runId));
  });
}

async function finalizeRuns() {
  await db.execute(sql`
    UPDATE runs SET status = 'done', finished_at = now()
    WHERE status = 'running'
      AND NOT EXISTS (
        SELECT 1 FROM checks WHERE checks.run_id = runs.id AND checks.status IN ('pending', 'processing')
      )
  `);
}

/** Processes pending checks until the batch is empty or the time budget runs out. */
export async function processPending({ budgetMs = 50_000, batch = CONCURRENCY } = {}) {
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs) {
    const claimed = await claimChecks(batch);
    if (!claimed.length) break;
    await Promise.all(claimed.map(processOne));
    processed += claimed.length;
  }
  await finalizeRuns();
  return processed;
}

/** One cron tick: start due runs, then work through the queue. */
export async function tick(budgetMs?: number) {
  const started = await scheduleDueRuns();
  const processed = await processPending({ budgetMs });
  return { started, processed };
}
