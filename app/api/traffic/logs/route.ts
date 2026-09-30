import { NextResponse } from "next/server";
import { brandByDrainToken, ingestLogs, parseLogs } from "@/lib/traffic";

export const dynamic = "force-dynamic";

const MAX_BODY = 20 * 1024 * 1024;

/** Log drain: hosting providers POST access logs here (token in ?t= or the x-traffic-token header). */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? req.headers.get("x-traffic-token") ?? "";
  const brand = await brandByDrainToken(token);
  if (!brand) return NextResponse.json({ error: "Unknown traffic key" }, { status: 401 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const result = await ingestLogs(brand.id, parseLogs(text));
  return NextResponse.json(result);
}

/** Some drains (e.g. Vercel) verify the endpoint with a GET first. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const brand = await brandByDrainToken(token);
  return brand ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Unknown traffic key" }, { status: 401 });
}
