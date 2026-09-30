"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireOrg, requireUser } from "@/lib/auth";
import { runAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { audits, brands, prompts, tasks, type Competitor } from "@/lib/db/schema";
import { countryByIso, inferIntent } from "@/lib/locations";
import { defaultEngines, planFor } from "@/lib/plans";
import { normalizeDomain } from "@/lib/tracking/analyze";
import { isEngine } from "@/lib/tracking/engines";
import { processPending, startRun } from "@/lib/tracking/runner";
import type { FormState } from "./auth";

function parseCompetitors(raw: string): Competitor[] {
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const [name, domain] = line.split(/\s*[|,]\s*/);
      return domain ? { name: name.trim(), domain: normalizeDomain(domain) } : { name: name.trim() };
    });
}

function parsePromptLines(raw: string): string[] {
  return [...new Set(raw.split(/\n/).map((l) => l.trim()).filter((l) => l.length >= 5))].map((l) => l.slice(0, 480));
}

async function editableOrg(orgId: string) {
  const user = await requireUser();
  const access = await requireOrg(user, orgId);
  if (!access.canEdit) throw new Error("You have view-only access to this workspace");
  return { user, ...access };
}

async function editableBrand(brandId: string) {
  const user = await requireUser();
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) throw new Error("Brand not found");
  const access = await requireOrg(user, brand.orgId);
  if (!access.canEdit) throw new Error("You have view-only access to this workspace");
  return { user, brand, ...access };
}

async function promptCount(orgId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(prompts)
    .innerJoin(brands, eq(brands.id, prompts.brandId))
    .where(and(eq(brands.orgId, orgId), eq(prompts.active, true)));
  return row?.n ?? 0;
}

const BrandSchema = z.object({
  name: z.string().trim().min(1, "Enter the brand name").max(120),
  domain: z.string().trim().min(3, "Enter the website domain").max(200),
  category: z.string().trim().max(120).default(""),
  country: z.string().default("US"),
  city: z.string().trim().max(80).optional(),
  aliases: z.string().default(""),
  competitors: z.string().default(""),
  prompts: z.string().default(""),
});

export async function createBrand(orgId: string, _: FormState, form: FormData): Promise<FormState> {
  const { org } = await editableOrg(orgId);
  const parsed = BrandSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const plan = planFor(org.plan);

  const [{ n: brandCount }] = await db.select({ n: count() }).from(brands).where(eq(brands.orgId, orgId));
  if (brandCount >= plan.brands) {
    return { error: `Your ${plan.name} plan includes ${plan.brands} brand${plan.brands > 1 ? "s" : ""}. Upgrade to add more.` };
  }

  const promptLines = parsePromptLines(input.prompts);
  const room = plan.prompts - (await promptCount(orgId));
  if (promptLines.length > room) {
    return { error: `Your plan has room for ${room} more prompt(s); you entered ${promptLines.length}.` };
  }

  const country = countryByIso(input.country);
  const [brand] = await db
    .insert(brands)
    .values({
      orgId,
      name: input.name,
      domain: normalizeDomain(input.domain),
      category: input.category,
      aliases: input.aliases.split(/[,\n]/).map((a) => a.trim()).filter(Boolean).slice(0, 10),
      competitors: parseCompetitors(input.competitors),
      locationCode: country.code,
      countryIso: country.iso,
      city: input.city || null,
      engines: defaultEngines(plan),
      frequency: "weekly",
      nextRunAt: null,
    })
    .returning({ id: brands.id });

  if (promptLines.length) {
    await db.insert(prompts).values(promptLines.map((text) => ({ brandId: brand.id, text, intent: inferIntent(text, input.city) })));
    await startRun(brand.id, "manual");
    after(() => processPending({ budgetMs: 240_000 }).catch(console.error));
  }
  redirect(`/app/o/${orgId}/b/${brand.id}`);
}

const SettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  domain: z.string().trim().min(3).max(200),
  category: z.string().trim().max(120).default(""),
  country: z.string().default("US"),
  city: z.string().trim().max(80).optional(),
  aliases: z.string().default(""),
  competitors: z.string().default(""),
  frequency: z.enum(["weekly", "daily"]),
});

export async function updateBrand(brandId: string, _: FormState, form: FormData): Promise<FormState> {
  const { brand, org } = await editableBrand(brandId);
  const parsed = SettingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const plan = planFor(org.plan);

  const engines = form.getAll("engines").map(String).filter(isEngine);
  if (engines.length === 0) return { error: "Choose at least one AI engine" };
  if (engines.length > plan.engineSlots) {
    return { error: `Your ${plan.name} plan tracks up to ${plan.engineSlots} engines per brand.` };
  }
  if (!plan.frequencies.includes(input.frequency)) {
    return { error: `Daily tracking is available on Growth and above.` };
  }

  const country = countryByIso(input.country);
  await db
    .update(brands)
    .set({
      name: input.name,
      domain: normalizeDomain(input.domain),
      category: input.category,
      aliases: input.aliases.split(/[,\n]/).map((a) => a.trim()).filter(Boolean).slice(0, 10),
      competitors: parseCompetitors(input.competitors),
      locationCode: country.code,
      countryIso: country.iso,
      city: input.city || null,
      engines,
      frequency: input.frequency,
    })
    .where(eq(brands.id, brandId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
  return { ok: "Settings saved" };
}

export async function addPrompts(brandId: string, _: FormState, form: FormData): Promise<FormState> {
  const { brand, org } = await editableBrand(brandId);
  const lines = parsePromptLines(String(form.get("prompts") ?? ""));
  const intent = String(form.get("intent") ?? "auto");
  if (!lines.length) return { error: "Enter at least one prompt (one per line)" };
  const plan = planFor(org.plan);
  const room = plan.prompts - (await promptCount(org.id));
  if (lines.length > room) return { error: `Your plan has room for ${room} more prompt(s).` };
  await db.insert(prompts).values(
    lines.map((text) => ({ brandId, text, intent: intent === "auto" ? inferIntent(text, brand.city) : intent })),
  );
  // A brand created without prompts has no schedule yet; start it now.
  if (!brand.nextRunAt) await db.update(brands).set({ nextRunAt: new Date() }).where(eq(brands.id, brandId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
  return { ok: `Added ${lines.length} prompt(s). They'll be checked on the next run.` };
}

export async function removePrompt(promptId: string) {
  const [row] = await db.select({ brandId: prompts.brandId }).from(prompts).where(eq(prompts.id, promptId)).limit(1);
  if (!row) return;
  const { brand } = await editableBrand(row.brandId);
  await db.update(prompts).set({ active: false }).where(eq(prompts.id, promptId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brand.id}`);
}

export async function runNow(brandId: string) {
  const { brand } = await editableBrand(brandId);
  await startRun(brandId, "manual");
  after(() => processPending({ budgetMs: 240_000 }).catch(console.error));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
}

export async function runBrandAudit(brandId: string) {
  const { brand } = await editableBrand(brandId);
  const report = await runAudit(brand.domain, { brand: brand.name, visibility: false });
  await db.insert(audits).values({ brandId, url: report.finalUrl, score: report.overall, report });
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
}

export async function deleteBrand(brandId: string) {
  const { brand } = await editableBrand(brandId);
  await db.delete(brands).where(eq(brands.id, brandId));
  redirect(`/app/o/${brand.orgId}`);
}

export async function setRecommendationState(brandId: string, recId: string, state: "done" | "dismissed" | "saved" | null) {
  const { brand } = await editableBrand(brandId);
  const next = { ...(brand.recState ?? {}) };
  if (state) next[recId] = state;
  else delete next[recId];
  await db.update(brands).set({ recState: next }).where(eq(brands.id, brandId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
}

/** Copies a recommendation onto the task board (useful for done-for-you delivery). */
export async function recommendationToTask(brandId: string, rec: { id: string; title: string; detail: string; steps: string[]; tag: string }) {
  const { brand, user } = await editableBrand(brandId);
  const category = /citation|featured/i.test(rec.tag + rec.title)
    ? "citations"
    : /content|answer|comparison/i.test(rec.tag)
      ? "content"
      : "technical";
  await db.insert(tasks).values({
    orgId: brand.orgId,
    brandId,
    title: rec.title.slice(0, 200),
    description: `${rec.detail}\n\n${rec.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    category,
    createdBy: user.id,
  });
  revalidatePath(`/app/o/${brand.orgId}/work`);
}

export async function updateReportRecipients(brandId: string, _: FormState, form: FormData): Promise<FormState> {
  const { brand } = await editableBrand(brandId);
  const emails = String(form.get("recipients") ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const bad = emails.filter((e) => !z.string().email().safeParse(e).success);
  if (bad.length) return { error: `Not a valid email: ${bad[0]}` };
  await db.update(brands).set({ reportRecipients: [...new Set(emails)].slice(0, 10) }).where(eq(brands.id, brandId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
  return { ok: emails.length ? `Monthly reports will go to ${emails.length} recipient(s) on the 1st of each month.` : "Monthly emails turned off." };
}

/** Ticks or unticks one step of a recommendation. */
export async function toggleRecStep(brandId: string, recId: string, step: number) {
  const { brand } = await editableBrand(brandId);
  const all = { ...(brand.recSteps ?? {}) };
  const set = new Set(all[recId] ?? []);
  if (set.has(step)) set.delete(step);
  else set.add(step);
  all[recId] = [...set].sort((a, b) => a - b);
  await db.update(brands).set({ recSteps: all }).where(eq(brands.id, brandId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
}

// ---------------------------------------------------------------------------
// Competitor management
// ---------------------------------------------------------------------------

const MAX_KEY = 10;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function saveCompetitors(brand: typeof brands.$inferSelect, patch: Partial<typeof brands.$inferInsert>) {
  await db.update(brands).set(patch).where(eq(brands.id, brand.id));
  revalidatePath(`/app/o/${brand.orgId}/b/${brand.id}`);
}

export async function addCompetitor(brandId: string, _: FormState, form: FormData): Promise<FormState> {
  const { brand } = await editableBrand(brandId);
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const domainRaw = String(form.get("domain") ?? "").trim();
  const key = form.get("key") === "on";
  if (name.length < 2) return { error: "Enter the competitor's name" };
  if (brand.competitors.some((c) => same(c.name, name))) return { error: `${name} is already tracked` };
  if (brand.competitors.length >= 30) return { error: "You can track up to 30 competitors per brand" };
  if (key && brand.keyCompetitors.length >= MAX_KEY) return { error: `You can mark up to ${MAX_KEY} key competitors` };
  await saveCompetitors(brand, {
    competitors: [...brand.competitors, domainRaw ? { name, domain: normalizeDomain(domainRaw) } : { name }],
    keyCompetitors: key ? [...brand.keyCompetitors, name] : brand.keyCompetitors,
    ignoredBrands: brand.ignoredBrands.filter((n) => !same(n, name)),
  });
  return { ok: `Now tracking ${name}` };
}

/** Starts tracking a brand the AI engines recommended (from the suggestions list). */
export async function trackSuggested(brandId: string, name: string) {
  const { brand } = await editableBrand(brandId);
  if (brand.competitors.some((c) => same(c.name, name))) return;
  await saveCompetitors(brand, { competitors: [...brand.competitors, { name: name.slice(0, 80) }] });
}

export async function setKeyCompetitor(brandId: string, name: string, key: boolean) {
  const { brand } = await editableBrand(brandId);
  const others = brand.keyCompetitors.filter((n) => !same(n, name));
  if (key && others.length >= MAX_KEY) return;
  await saveCompetitors(brand, { keyCompetitors: key ? [...others, name] : others });
}

export async function removeCompetitor(brandId: string, name: string) {
  const { brand } = await editableBrand(brandId);
  await saveCompetitors(brand, {
    competitors: brand.competitors.filter((c) => !same(c.name, name)),
    keyCompetitors: brand.keyCompetitors.filter((n) => !same(n, name)),
  });
}

/** Removes a brand from rankings and share of voice (e.g. a directory or a false match). */
export async function ignoreBrand(brandId: string, name: string) {
  const { brand } = await editableBrand(brandId);
  if (same(name, brand.name)) return;
  await saveCompetitors(brand, {
    competitors: brand.competitors.filter((c) => !same(c.name, name)),
    keyCompetitors: brand.keyCompetitors.filter((n) => !same(n, name)),
    ignoredBrands: [...brand.ignoredBrands.filter((n) => !same(n, name)), name].slice(-100),
  });
}

export async function unignoreBrand(brandId: string, name: string) {
  const { brand } = await editableBrand(brandId);
  await saveCompetitors(brand, { ignoredBrands: brand.ignoredBrands.filter((n) => !same(n, name)) });
}
