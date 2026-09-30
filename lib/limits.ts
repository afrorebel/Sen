import "server-only";
import { and, count, eq, gte, ne } from "drizzle-orm";
import { db } from "./db";
import { brands, memberships, runs, users } from "./db/schema";
import { planFor } from "./plans";

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

/** "Run check now" runs this calendar month across the workspace, and how many the plan still allows. */
export async function manualRunAllowance(orgId: string, planId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(and(eq(brands.orgId, orgId), eq(runs.trigger, "manual"), gte(runs.startedAt, monthStart())));
  const limit = planFor(planId).manualRuns;
  const used = row?.n ?? 0;
  return { used, limit, left: Math.max(0, limit - used) };
}

/** Team seats in use: owners and members. Client portal logins and our own staff don't take a seat. */
export async function seatsUsed(orgId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), ne(memberships.role, "client"), eq(users.isStaff, false)));
  return row?.n ?? 0;
}

/**
 * After a plan change, moves brands onto a frequency the plan allows and trims engines to its
 * slots. On an upgrade the next check runs straight away instead of waiting out the old schedule.
 */
export async function syncBrandsToPlan(orgId: string, planId: string, upgraded: boolean) {
  const plan = planFor(planId);
  const rows = await db.select().from(brands).where(eq(brands.orgId, orgId));
  for (const b of rows) {
    const frequency = plan.frequencies.includes(b.frequency) ? b.frequency : plan.frequencies.includes("weekly") ? "weekly" : plan.frequencies[0];
    const engines = b.engines.slice(0, plan.engineSlots);
    // An upgrade unlocks more engines: fill the new slots with the default order.
    const all = ["chatgpt", "google_ai_mode", "perplexity", "gemini", "claude"];
    for (const e of all) if (upgraded && engines.length < plan.engineSlots && !engines.includes(e)) engines.push(e);
    await db
      .update(brands)
      .set({ frequency, engines, ...(upgraded ? { nextRunAt: new Date() } : {}) })
      .where(eq(brands.id, b.id));
  }
}
