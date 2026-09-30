import type { EngineId } from "./tracking/engines";

/**
 * Self-serve plans are Free, Pro and Agency. "dfy" is not sold online: staff assign it after a
 * sales call (Admin page), and it unlocks everything Agency has.
 */
export type PlanId = "free" | "pro" | "agency" | "dfy";

export type Frequency = "monthly" | "weekly" | "daily";

/** Paid features the app checks before showing or running something. */
export type Feature =
  | "competitors" // competitor management and share-of-voice detail
  | "sources" // full cited-sources analysis
  | "tasks" // full task list with steps (Free sees the top 3 only)
  | "traffic" // AI crawler and AI referral traffic
  | "reports" // monthly PDF: download, email, auto-send
  | "clientPortal" // client (read-only) logins
  | "whiteLabel"; // PDF reports under the workspace's own name and logo

export interface Plan {
  id: PlanId;
  name: string;
  /** USD per month on monthly billing; null = quote only. */
  monthly: number | null;
  /** USD per year when billed yearly (two months free). */
  yearly: number | null;
  tagline: string;
  brands: number;
  /** Tracked prompts across the whole workspace. */
  prompts: number;
  /** How many engines each brand can track at once. */
  engineSlots: number;
  frequencies: Frequency[];
  /** Extra "Run check now" runs per workspace per calendar month (scheduled checks don't count). */
  manualRuns: number;
  /** Team seats including the owner (client logins don't count). null = unlimited. */
  seats: number | null;
  features: Feature[];
  /** Bullet points on pricing and billing pages. */
  bullets: string[];
  highlight?: boolean;
}

const ALL: Feature[] = ["competitors", "sources", "tasks", "traffic", "reports", "clientPortal", "whiteLabel"];

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    tagline: "A first look at what ChatGPT says about you.",
    brands: 1,
    prompts: 5,
    engineSlots: 1,
    frequencies: ["monthly"],
    manualRuns: 0,
    seats: 1,
    features: [],
    bullets: ["1 brand, 5 prompts", "1 AI engine (ChatGPT)", "Checked once a month", "AEO score and your top 3 tasks", "AEO site audit"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly: 79,
    yearly: 790,
    tagline: "For businesses that want to be the answer.",
    brands: 3,
    prompts: 100,
    engineSlots: 5,
    frequencies: ["weekly"],
    manualRuns: 4,
    seats: 3,
    features: ["competitors", "sources", "tasks", "traffic", "reports"],
    bullets: [
      "3 brands, 100 prompts",
      "All 5 AI engines",
      "Weekly tracking + 4 on-demand re-checks a month",
      "Competitors, share of voice and cited sources",
      "Every task with step-by-step fixes",
      "AI crawler and AI referral traffic",
      "Monthly PDF report, emailed automatically",
      "3 team seats",
    ],
    highlight: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    monthly: 249,
    yearly: 2490,
    tagline: "For agencies and consultants serving clients.",
    brands: 15,
    prompts: 500,
    engineSlots: 5,
    frequencies: ["weekly"],
    manualRuns: 15,
    seats: null,
    features: ALL,
    bullets: [
      "15 brands, 500 prompts",
      "Everything in Pro",
      "15 on-demand re-checks a month",
      "White-label PDF reports under your agency's name and logo",
      "Client portal logins",
      "Reports emailed to your clients",
      "Unlimited team seats",
    ],
  },
  dfy: {
    id: "dfy",
    name: "Done For You",
    monthly: null,
    yearly: null,
    tagline: "Our team does the work. You watch the results.",
    brands: 3,
    prompts: 200,
    engineSlots: 5,
    frequencies: ["weekly", "daily"],
    manualRuns: 30,
    seats: null,
    features: ALL,
    bullets: [
      "Full AEO audit and technical fixes",
      "Answer-first articles every month",
      "Schema, llms.txt and FAQ implementation",
      "Citation and listing outreach",
      "Every task and deliverable in your portal",
    ],
  },
};

/** Plans sold online, in display order. */
export const SELF_SERVE: PlanId[] = ["free", "pro", "agency"];

/** Old plan ids from before the two-tier pricing, kept so existing rows and Stripe prices still resolve. */
const LEGACY: Record<string, PlanId> = { starter: "pro", growth: "pro" };

export function planFor(id: string): Plan {
  return PLANS[(LEGACY[id] ?? id) as PlanId] ?? PLANS.free;
}

export function hasFeature(planId: string, feature: Feature): boolean {
  return planFor(planId).features.includes(feature);
}

/** The cheapest plan that unlocks a feature, for upgrade prompts. */
export function planWith(feature: Feature): Plan {
  return SELF_SERVE.map((id) => PLANS[id]).find((p) => p.features.includes(feature)) ?? PLANS.agency;
}

export function defaultEngines(plan: Plan): EngineId[] {
  const order: EngineId[] = ["chatgpt", "google_ai_mode", "perplexity", "gemini", "claude"];
  return order.slice(0, plan.engineSlots);
}

export const FREQUENCY_DAYS: Record<Frequency, number> = { monthly: 30, weekly: 7, daily: 1 };

/** Effective monthly price on yearly billing, rounded to the dollar. */
export const perMonthYearly = (p: Plan) => (p.yearly ? Math.round(p.yearly / 12) : 0);
