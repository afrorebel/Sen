import type { EngineId } from "./tracking/engines";

export type PlanId = "free" | "starter" | "growth" | "agency" | "dfy";

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  annualMonthly: number;
  tagline: string;
  brands: number;
  prompts: number;
  /** How many engines each brand can track at once. */
  engineSlots: number;
  frequencies: ("weekly" | "daily")[];
  auditPages: number;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    monthly: 0,
    annualMonthly: 0,
    tagline: "See where you stand in AI answers.",
    brands: 1,
    prompts: 10,
    engineSlots: 2,
    frequencies: ["weekly"],
    auditPages: 1,
    features: ["1 brand, 10 prompts", "ChatGPT + Google AI Mode", "Weekly tracking", "Homepage AEO audit"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthly: 49,
    annualMonthly: 39,
    tagline: "For a single business getting cited.",
    brands: 1,
    prompts: 50,
    engineSlots: 3,
    frequencies: ["weekly"],
    auditPages: 100,
    features: ["1 brand, 50 prompts", "3 AI engines", "Weekly tracking", "Competitor share of voice", "Cited-source insights"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthly: 129,
    annualMonthly: 103,
    tagline: "For growing brands and consultants.",
    brands: 3,
    prompts: 150,
    engineSlots: 4,
    frequencies: ["weekly", "daily"],
    auditPages: 500,
    features: ["3 brands, 150 prompts", "4 AI engines", "Weekly or daily tracking", "Everything in Starter", "PDF reports"],
    highlight: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    monthly: 349,
    annualMonthly: 279,
    tagline: "For agencies reselling AEO.",
    brands: 10,
    prompts: 400,
    engineSlots: 5,
    frequencies: ["weekly", "daily"],
    auditPages: 2000,
    features: ["10 brands, 400 prompts", "All 5 AI engines", "Client portal logins", "White-label reports", "Everything in Growth"],
  },
  dfy: {
    id: "dfy",
    name: "Done For You",
    monthly: 799,
    annualMonthly: 799,
    tagline: "Our team does the work. You watch the results.",
    brands: 1,
    prompts: 100,
    engineSlots: 5,
    frequencies: ["weekly", "daily"],
    auditPages: 500,
    features: [
      "Full AEO audit and technical fixes",
      "4 answer-first articles a month",
      "Schema, llms.txt and FAQ implementation",
      "Monthly share-of-voice report",
      "Client portal with every task and deliverable",
    ],
  },
};

export function planFor(id: string): Plan {
  return PLANS[id as PlanId] ?? PLANS.free;
}

export function defaultEngines(plan: Plan): EngineId[] {
  const order: EngineId[] = ["chatgpt", "google_ai_mode", "perplexity", "gemini", "claude"];
  return order.slice(0, plan.engineSlots);
}
