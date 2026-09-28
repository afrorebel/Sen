import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { tick } from "@/lib/tracking/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(request.url);
  const given = request.headers.get("x-cron-secret") ?? url.searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called by Hostinger's cron every 5 minutes:
 *   curl -fsS "https://aeogrowthleads.com/api/cron?key=$CRON_SECRET"
 * Starts due tracking runs, then works through pending checks for ~50 seconds.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tick(50_000);
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
