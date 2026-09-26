import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";
import { FetchError } from "@/lib/audit/fetcher";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: { url?: unknown; brand?: unknown; visibility?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "Please enter a website URL" }, { status: 400 });
  }
  try {
    const report = await runAudit(body.url, {
      brand: typeof body.brand === "string" ? body.brand.slice(0, 100) : undefined,
      visibility: body.visibility !== false,
    });
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof FetchError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Audit failed", err);
    return NextResponse.json({ error: "The audit failed unexpectedly. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  const { visibilityEnabled } = await import("@/lib/audit/visibility");
  return NextResponse.json({ visibilityAvailable: visibilityEnabled() });
}
