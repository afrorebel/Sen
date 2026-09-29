import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getUser, getOrgs } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import { renderMonthlyReport } from "@/lib/reports/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports/:brandId?period=YYYY-MM → the monthly PDF (signed-in members of the workspace only). */
export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { brandId } = await params;
  const [brand] = await db.select({ orgId: brands.orgId }).from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.isStaff && !(await getOrgs(user.id)).some((m) => m.org.id === brand.orgId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const period = new URL(request.url).searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: "Invalid period" }, { status: 400 });

  const rendered = await renderMonthlyReport(brandId, period);
  if (!rendered) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(rendered.buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${rendered.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
