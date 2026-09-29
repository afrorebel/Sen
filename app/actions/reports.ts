"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import { sendMonthlyReport } from "@/lib/reports/send";
import type { FormState } from "./auth";

/** "Send as email" from the Reports tab: emails the chosen month's PDF to one address. */
export async function sendReportNowAction(brandId: string, period: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) return { error: "Brand not found" };
  await requireOrg(user, brand.orgId);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Invalid month" };
  try {
    await sendMonthlyReport(brandId, period, [email]);
  } catch (err) {
    console.error("Report email failed", err);
    return { error: "We couldn't send the report right now. Please try again." };
  }
  return { ok: `Report sent to ${email}` };
}
