import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** AEOGrowthLeads team member: can see every organization and run done-for-you work. */
  isStaff: boolean("is_staff").notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  /** SHA-256 of the session token; the raw token only lives in the cookie. */
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  /** Done-for-you client: our team delivers work tracked in tasks/deliverables. */
  doneForYou: boolean("done_for_you").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: createdAt(),
});

export type MemberRole = "owner" | "member" | "client";

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** owner/member manage the workspace; client is a read-only portal login. */
    role: text("role").$type<MemberRole>().notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export interface Competitor {
  name: string;
  domain?: string;
}

export const brands = pgTable(
  "brands",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    /** What the business sells, e.g. "water damage restoration" — drives prompt suggestions. */
    category: text("category").notNull().default(""),
    /** Other names the brand goes by (abbreviations, product names). */
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    competitors: jsonb("competitors").$type<Competitor[]>().notNull().default([]),
    /** DataForSEO location code, e.g. 2840 = United States. */
    locationCode: integer("location_code").notNull().default(2840),
    languageCode: text("language_code").notNull().default("en"),
    countryIso: text("country_iso").notNull().default("US"),
    city: text("city"),
    engines: jsonb("engines").$type<string[]>().notNull().default([]),
    frequency: text("frequency").$type<"weekly" | "daily">().notNull().default("weekly"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("brands_org_idx").on(t.orgId), index("brands_next_run_idx").on(t.nextRunAt)],
);

export const prompts = pgTable(
  "prompts",
  {
    id: id(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** best | problem | comparison | local | other — mirrors the playbook's four buckets. */
    intent: text("intent").notNull().default("best"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("prompts_brand_idx").on(t.brandId)],
);

export const runs = pgTable(
  "runs",
  {
    id: id(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    status: text("status").$type<"running" | "done" | "failed">().notNull().default("running"),
    trigger: text("trigger").$type<"schedule" | "manual">().notNull().default("schedule"),
    checksTotal: integer("checks_total").notNull().default(0),
    checksDone: integer("checks_done").notNull().default(0),
    cost: real("cost").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("runs_brand_idx").on(t.brandId, t.startedAt)],
);

export interface Source {
  url: string;
  domain: string;
  title?: string;
}

export interface BrandHit {
  name: string;
  position: number;
  isOwn: boolean;
}

export const checks = pgTable(
  "checks",
  {
    id: id(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    engine: text("engine").notNull(),
    status: text("status").$type<"pending" | "processing" | "done" | "error">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    mentioned: boolean("mentioned"),
    position: integer("position"),
    cited: boolean("cited"),
    answer: text("answer"),
    sources: jsonb("sources").$type<Source[]>(),
    brandsFound: jsonb("brands_found").$type<BrandHit[]>(),
    cost: real("cost"),
    error: text("error"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("checks_run_idx").on(t.runId), index("checks_status_idx").on(t.status)],
);

export const audits = pgTable(
  "audits",
  {
    id: id(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    score: integer("score").notNull(),
    report: jsonb("report").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audits_brand_idx").on(t.brandId, t.createdAt)],
);

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** technical | content | citations | local | reporting | other */
    category: text("category").notNull().default("technical"),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    clientVisible: boolean("client_visible").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_org_idx").on(t.orgId, t.status)],
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    /** article | reddit | linkedin | schema | llms_txt | gbp_post | press | report | other */
    type: text("type").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    notes: text("notes").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deliverables_org_idx").on(t.orgId, t.deliveredAt)],
);

export const taskComments = pgTable("task_comments", {
  id: id(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Check = typeof checks.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
