"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireOrg, requireStaff, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  brands,
  deliverables,
  memberships,
  organizations,
  taskComments,
  tasks,
  users,
  type MemberRole,
  type TaskStatus,
} from "@/lib/db/schema";
import { PLANS, type PlanId } from "@/lib/plans";
import type { FormState } from "./auth";

async function editor(orgId: string) {
  const user = await requireUser();
  const access = await requireOrg(user, orgId);
  if (!access.canEdit) throw new Error("You have view-only access to this workspace");
  return { user, ...access };
}

async function brandInOrg(orgId: string, brandId: string | null) {
  if (!brandId) return null;
  const [b] = await db.select({ id: brands.id }).from(brands).where(and(eq(brands.id, brandId), eq(brands.orgId, orgId)));
  return b?.id ?? null;
}

const workPath = (orgId: string) => `/app/o/${orgId}/work`;

const TaskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: z.string().trim().max(5000).default(""),
  category: z.enum(["technical", "content", "citations", "local", "reporting", "other"]).default("technical"),
  brandId: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

export async function createTask(orgId: string, _: FormState, form: FormData): Promise<FormState> {
  const { user } = await editor(orgId);
  const parsed = TaskSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const t = parsed.data;
  // Only staff can hide tasks from the client (internal notes, QA steps).
  const clientVisible = user.isStaff ? form.get("clientVisible") === "on" : true;
  await db.insert(tasks).values({
    orgId,
    brandId: await brandInOrg(orgId, t.brandId || null),
    title: t.title,
    description: t.description,
    category: t.category,
    dueDate: t.dueDate ? new Date(t.dueDate) : null,
    assigneeId: user.isStaff && t.assigneeId ? t.assigneeId : null,
    clientVisible,
    createdBy: user.id,
  });
  revalidatePath(workPath(orgId));
  return { ok: "Task added" };
}

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return;
  await editor(task.orgId);
  await db.update(tasks).set({ status, updatedAt: new Date() }).where(eq(tasks.id, taskId));
  revalidatePath(workPath(task.orgId));
}

export async function addComment(taskId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { error: "Task not found" };
  const access = await requireOrg(user, task.orgId);
  if (!task.clientVisible && access.role === "client" && !user.isStaff) return { error: "Task not found" };
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return { error: "Write a comment first" };
  await db.insert(taskComments).values({ taskId, userId: user.id, body });
  revalidatePath(workPath(task.orgId));
  return { ok: "Comment posted" };
}

const DeliverableSchema = z.object({
  title: z.string().trim().min(1, "Give the deliverable a title").max(200),
  type: z.enum(["article", "reddit", "linkedin", "schema", "llms_txt", "gbp_post", "press", "report", "fix", "other"]),
  url: z.string().trim().url("Enter a full URL (https://…)").optional().or(z.literal("")),
  notes: z.string().trim().max(4000).default(""),
  brandId: z.string().optional(),
  taskId: z.string().optional(),
});

export async function createDeliverable(orgId: string, _: FormState, form: FormData): Promise<FormState> {
  const { user } = await editor(orgId);
  const parsed = DeliverableSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  let taskId: string | null = null;
  if (d.taskId) {
    const [t] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, d.taskId), eq(tasks.orgId, orgId)));
    taskId = t?.id ?? null;
  }
  await db.insert(deliverables).values({
    orgId,
    brandId: await brandInOrg(orgId, d.brandId || null),
    taskId,
    type: d.type,
    title: d.title,
    url: d.url || null,
    notes: d.notes,
    createdBy: user.id,
  });
  revalidatePath(workPath(orgId));
  return { ok: "Deliverable logged" };
}

const MemberSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["member", "client"]),
  password: z.string().min(8, "Temporary password needs 8+ characters").max(200),
});

/** Adds a teammate or a read-only client login. Existing users are simply linked. */
export async function addMember(orgId: string, _: FormState, form: FormData): Promise<FormState> {
  const { role } = await editor(orgId);
  if (role !== "owner") return { error: "Only workspace owners can add people" };
  const parsed = MemberSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const m = parsed.data;

  let [user] = await db.select().from(users).where(eq(users.email, m.email)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ name: m.name, email: m.email, passwordHash: await hashPassword(m.password) })
      .returning();
  }
  await db
    .insert(memberships)
    .values({ userId: user.id, orgId, role: m.role as MemberRole })
    .onConflictDoUpdate({ target: [memberships.userId, memberships.orgId], set: { role: m.role } });
  revalidatePath(`/app/o/${orgId}/team`);
  return { ok: `${m.name} can now log in with ${m.email}` };
}

export async function removeMember(orgId: string, userId: string) {
  const { role, user } = await editor(orgId);
  if (role !== "owner" || user.id === userId) return;
  await db.delete(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  revalidatePath(`/app/o/${orgId}/team`);
}

// ---------------------------------------------------------------------------
// Staff-only administration
// ---------------------------------------------------------------------------

const ClientOrgSchema = z.object({
  name: z.string().trim().min(1, "Enter the client's business name").max(120),
  plan: z.enum(Object.keys(PLANS) as [PlanId, ...PlanId[]]),
  ownerName: z.string().trim().max(100).optional(),
  ownerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  ownerPassword: z.string().max(200).optional(),
});

export async function createClientOrg(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = ClientOrgSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const c = parsed.data;
  const doneForYou = c.plan === "dfy" || form.get("doneForYou") === "on";

  const [org] = await db
    .insert(organizations)
    .values({ name: c.name, plan: c.plan, doneForYou })
    .returning({ id: organizations.id });
  // Staff who create the workspace are added so it shows in their switcher.
  await db.insert(memberships).values({ userId: staff.id, orgId: org.id, role: "owner" });

  if (c.ownerEmail) {
    if (!c.ownerPassword || c.ownerPassword.length < 8) return { error: "Set an 8+ character temporary password for the client" };
    let [user] = await db.select().from(users).where(eq(users.email, c.ownerEmail)).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({ name: c.ownerName || c.name, email: c.ownerEmail, passwordHash: await hashPassword(c.ownerPassword) })
        .returning();
    }
    // Done-for-you clients get a portal login; self-serve customers own their workspace.
    await db
      .insert(memberships)
      .values({ userId: user.id, orgId: org.id, role: doneForYou ? "client" : "owner" })
      .onConflictDoNothing();
  }
  revalidatePath("/admin");
  return { ok: `Created ${c.name}` };
}

export async function updateOrgPlan(orgId: string, form: FormData) {
  await requireStaff();
  const plan = String(form.get("plan"));
  if (!(plan in PLANS)) return;
  await db
    .update(organizations)
    .set({ plan, doneForYou: plan === "dfy" || form.get("doneForYou") === "on" })
    .where(eq(organizations.id, orgId));
  revalidatePath("/admin");
}

/** The standard done-for-you onboarding plan, drawn from the AEO playbook's 90-day sequence. */
const DFY_TEMPLATE: { title: string; category: string; description: string; week: number; clientVisible?: boolean }[] = [
  { week: 0, category: "reporting", title: "Kickoff call and access (site CMS, Google Search Console, Google Business Profile)", description: "Collect logins, business goals, ideal customer profile, service areas and brand voice notes." },
  { week: 0, category: "reporting", title: "Baseline AI visibility audit (20+ buyer prompts across engines)", description: "Set up tracked prompts in the platform across best/top, problem, comparison and local buckets. Record who is named and which sources are cited." },
  { week: 1, category: "technical", title: "Technical AEO fixes: robots.txt, AI crawler access, CDN/WAF bot rules", description: "Allow OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot. Confirm no noindex/nosnippet on key pages." },
  { week: 1, category: "technical", title: "Publish llms.txt and pricing.md", description: "Plain-language summary of the business with links to key pages; visible pricing for AI agents comparing vendors." },
  { week: 1, category: "technical", title: "Schema markup: Organization/LocalBusiness, FAQPage, Service, BreadcrumbList", description: "Include sameAs links to LinkedIn, Google Business Profile, review sites and social profiles." },
  { week: 1, category: "technical", title: "Titles, meta descriptions, alt text, Open Graph, headings", description: "Answer-first titles and descriptions; question-style H2s on key service pages." },
  { week: 2, category: "citations", title: "Citation source map: threads, listicles and directories the engines cite", description: "Use the Cited Sources report. Build the target list of Reddit threads, roundup articles to pitch, and directories to claim.", clientVisible: true },
  { week: 2, category: "local", title: "Google Business Profile optimization", description: "Categories, services, Q&A, photos, posting schedule, review response process." },
  { week: 2, category: "citations", title: "Directory listings: claim and correct NAP across major directories", description: "Consistent Name, Address, Phone everywhere." },
  { week: 3, category: "content", title: "Content plan: 4 answer-first articles for the month", description: "One per high-value prompt. 40–60 word direct answer up top, fact blocks with real numbers, comparison table, FAQ, author and last-updated date." },
  { week: 4, category: "reporting", title: "Month 1 share-of-voice report and next-month plan", description: "Re-run all prompts, compare to baseline, screenshot wins, pick the next targets." },
];

export async function applyDfyTemplate(orgId: string) {
  const staff = await requireStaff();
  const now = Date.now();
  await db.insert(tasks).values(
    DFY_TEMPLATE.map((t) => ({
      orgId,
      title: t.title,
      description: t.description,
      category: t.category,
      clientVisible: t.clientVisible ?? true,
      dueDate: new Date(now + (t.week * 7 + 5) * 86_400_000),
      createdBy: staff.id,
    })),
  );
  revalidatePath(workPath(orgId));
}
