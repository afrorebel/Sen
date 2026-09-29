import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { brands, reportSends } from "../db/schema";
import { sendReportEmail } from "../email";
import { monthlyReportData, periodBounds, previousPeriod } from "./data";
import { MonthlyReportPdf } from "./pdf";

export async function renderMonthlyReport(brandId: string, period: string) {
  const data = await monthlyReportData(brandId, period);
  if (!data) return null;
  const buffer = await renderToBuffer(<MonthlyReportPdf data={data} />);
  const slug = data.brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { buffer, data, filename: `${slug}-ai-visibility-${period}.pdf` };
}

export async function sendMonthlyReport(brandId: string, period: string, recipients: string[]) {
  const rendered = await renderMonthlyReport(brandId, period);
  if (!rendered) throw new Error("Brand not found");
  const { data, buffer, filename } = rendered;
  await sendReportEmail(recipients, {
    brandName: data.brand.name,
    periodLabel: data.periodLabel,
    score: data.report.score,
    summary: data.summary,
    attachment: { filename, content: buffer },
  });
}

/**
 * Called from the cron tick. On the first ticks of a month, emails last month's report to each brand's
 * recipients. A row in report_sends is claimed first, so overlapping ticks can never double-send.
 */
export async function sendDueMonthlyReports(limit = 5): Promise<number> {
  const period = previousPeriod();
  const { start, end } = periodBounds(period);
  const due = await db
    .select({ id: brands.id, recipients: brands.reportRecipients })
    .from(brands)
    .where(
      and(
        sql`jsonb_array_length(${brands.reportRecipients}) > 0`,
        sql`NOT EXISTS (SELECT 1 FROM report_sends rs WHERE rs.brand_id = ${brands.id} AND rs.period = ${period})`,
        sql`EXISTS (SELECT 1 FROM runs r WHERE r.brand_id = ${brands.id} AND r.started_at >= ${start.toISOString()} AND r.started_at < ${end.toISOString()})`,
      ),
    )
    .limit(limit);

  let sent = 0;
  for (const b of due) {
    const claimed = await db
      .insert(reportSends)
      .values({ brandId: b.id, period, recipients: b.recipients })
      .onConflictDoNothing()
      .returning();
    if (!claimed.length) continue;
    try {
      await sendMonthlyReport(b.id, period, b.recipients);
      sent++;
    } catch (err) {
      console.error(`Monthly report for brand ${b.id} failed`, err);
      // Release the claim so the next tick retries.
      await db.delete(reportSends).where(and(eq(reportSends.brandId, b.id), eq(reportSends.period, period)));
    }
  }
  return sent;
}
