export type Status = "pass" | "warn" | "fail" | "info";
export type Impact = "high" | "medium" | "low";
export type Effort = "low" | "medium" | "high";

export type CategoryId =
  | "crawler"
  | "schema"
  | "content"
  | "trust"
  | "technical"
  | "visibility";

export interface CheckResult {
  id: string;
  category: CategoryId;
  title: string;
  status: Status;
  /** What we found, in one or two sentences. */
  detail: string;
  /** What to do about it (omitted when passing). */
  recommendation?: string;
  impact: Impact;
  effort: Effort;
  /** Relative weight inside its category. */
  weight: number;
  /** 0..1 — partial credit. pass=1, fail=0 by default. */
  score: number;
  evidence?: string[];
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  description: string;
  score: number; // 0..100
  weight: number;
  passed: number;
  total: number;
}

export interface CrawlerAccess {
  bot: string;
  owner: string;
  purpose: "training" | "search" | "user-fetch";
  allowed: boolean;
  rule?: string;
}

export interface VisibilityPrompt {
  prompt: string;
  mentioned: boolean;
  cited: boolean;
  position: number | null;
  competitors: string[];
  excerpt: string;
}

export interface VisibilityResult {
  engine: string;
  model: string;
  prompts: VisibilityPrompt[];
  mentionRate: number;
  citationRate: number;
  shareOfVoice: number;
  topCompetitors: { name: string; mentions: number }[];
  error?: string;
}

export interface PageSnapshot {
  url: string;
  finalUrl: string;
  status: number;
  responseMs: number;
  bytes: number;
  headers: Record<string, string>;
  html: string;
}

export interface AuditReport {
  url: string;
  finalUrl: string;
  domain: string;
  brand: string;
  auditedAt: string;
  durationMs: number;
  overall: number;
  band: "low" | "moderate" | "high";
  categories: CategoryScore[];
  checks: CheckResult[];
  crawlers: CrawlerAccess[];
  actionPlan: CheckResult[];
  quickWins: CheckResult[];
  visibility?: VisibilityResult;
  page: {
    title: string;
    description: string;
    wordCount: number;
    responseMs: number;
    bytes: number;
    schemaTypes: string[];
    /** HTML5 semantic tags used on the page, and how much of the markup is semantic. */
    semantics?: { tags: string[]; semantic: number; nonSemantic: number };
  };
}
