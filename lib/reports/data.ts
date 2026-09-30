import "server-only";
import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import { db } from "../db";
import { deliverables, organizations, tasks, type Brand } from "../db/schema";
import { hasFeature } from "../plans";
import { brandVisibility, type BrandVisibility } from "../tracking/metrics";
import { buildBrandReport, type BrandReport } from "../tracking/report";

const TYPE_LABEL: Record<string, string> = {
  article: "Article",
  reddit: "Reddit post",
  linkedin: "LinkedIn post",
  schema: "Schema markup",
  llms_txt: "llms.txt",
  gbp_post: "Google Business post",
  press: "Press release",
  report: "Report",
  fix: "Technical fix",
  other: "Other",
};

export interface MonthlyReportData {
  brand: Brand;
  period: string;
  periodLabel: string;
  report: BrandReport;
  previous: BrandVisibility | null;
  previousScore: number | null;
  summary: string[];
  delivered: { id: string; title: string; typeLabel: string; deliveredAt: Date }[];
  completedTasks: { id: string; title: string; updatedAt: Date }[];
  /** Who the report is "prepared by": us, or the agency on a white-label plan. */
  branding: ReportBranding;
}

export interface ReportBranding {
  name: string;
  logo: string | null;
  whiteLabel: boolean;
}

export const DEFAULT_BRANDING: ReportBranding = { name: "AEO GrowthLead", logo: null, whiteLabel: false };

/** The workspace's white-label name and logo if its plan includes it and they've been set. */
export async function reportBranding(orgId: string): Promise<ReportBranding> {
  const [org] = await db
    .select({ plan: organizations.plan, name: organizations.reportName, logo: organizations.reportLogo })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  if (!org || !hasFeature(org.plan, "whiteLabel") || !org.name) return DEFAULT_BRANDING;
  return { name: org.name, logo: org.logo, whiteLabel: true };
}

export function periodBounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end, label: start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

export function previousPeriod(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

/** Everything in the monthly PDF: the state at month end, compared with the previous month's end. */
export async function monthlyReportData(brandId: string, period: string): Promise<MonthlyReportData | null> {
  const { start, end, label } = periodBounds(period);
  const report = await buildBrandReport(brandId, end);
  if (!report) return null;
  const prevReport = await buildBrandReport(brandId, start);
  const previous = prevReport?.vis.latest ? prevReport.vis : null;
  const brand = report.brand;

  const inMonth = (col: typeof deliverables.deliveredAt | typeof tasks.updatedAt) => and(gte(col, start), lt(col, end));
  const delivered = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.orgId, brand.orgId), or(eq(deliverables.brandId, brandId), isNull(deliverables.brandId)), inMonth(deliverables.deliveredAt)))
    .orderBy(deliverables.deliveredAt);
  const completed = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.orgId, brand.orgId),
        or(eq(tasks.brandId, brandId), isNull(tasks.brandId)),
        eq(tasks.status, "done"),
        eq(tasks.clientVisible, true),
        inMonth(tasks.updatedAt),
      ),
    )
    .orderBy(tasks.updatedAt);

  const latest = report.vis.latest;
  const summary: string[] = [];
  if (latest) {
    summary.push(
      `AI engines named ${brand.name} in ${Math.round(latest.mentionRate * 100)}% of ${latest.checks} answers and cited the website in ${Math.round(latest.citationRate * 100)}%.`,
    );
    const best = [...report.presence].sort((a, b) => b.mentioned / (b.prompts || 1) - a.mentioned / (a.prompts || 1))[0];
    const worst = [...report.presence].sort((a, b) => a.mentioned / (a.prompts || 1) - b.mentioned / (b.prompts || 1))[0];
    if (best && best.prompts) summary.push(`Strongest engine: ${best.label} (named in ${best.mentioned} of ${best.prompts} answers).`);
    if (worst && worst !== best && worst.prompts) summary.push(`Biggest gap: ${worst.label} (named in ${worst.mentioned} of ${worst.prompts}).`);
    const rival = report.vis.competitors.find((c) => !c.isOwn);
    if (rival) summary.push(`Most-recommended competitor: ${rival.name}, with ${Math.round(rival.share * 100)}% share of voice.`);
  } else {
    summary.push("No AI visibility checks ran in this month yet.");
  }
  if (delivered.length || completed.length) {
    summary.push(`${delivered.length} deliverable${delivered.length === 1 ? "" : "s"} shipped and ${completed.length} task${completed.length === 1 ? "" : "s"} completed.`);
  }

  return {
    brand,
    period,
    periodLabel: label,
    report,
    previous,
    previousScore: prevReport?.score ?? null,
    summary,
    delivered: delivered.map((d) => ({ id: d.id, title: d.title, typeLabel: TYPE_LABEL[d.type] ?? d.type, deliveredAt: d.deliveredAt })),
    completedTasks: completed.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt })),
    branding: await reportBranding(brand.orgId),
  };
}
