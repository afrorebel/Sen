import { assistantFor, brandByTrafficToken, recordReferral } from "@/lib/traffic";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

/**
 * Beacon from /t.js on the client's site. Only visits whose referrer or utm_source is an AI assistant
 * are stored; nothing about the visitor (IP, user agent, query string) is kept.
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  let t = url.searchParams.get("t") ?? "";
  let r = url.searchParams.get("r") ?? "";
  let s = url.searchParams.get("s") ?? "";
  let p = url.searchParams.get("p") ?? "/";
  if (req.method === "POST") {
    try {
      const body = JSON.parse(await req.text()) as Record<string, string>;
      t = body.t ?? t;
      r = body.r ?? r;
      s = body.s ?? s;
      p = body.p ?? p;
    } catch {
      /* query params only */
    }
  }
  const assistant = (s && assistantFor(s)) || (r && assistantFor(r));
  if (assistant) {
    const brand = await brandByTrafficToken(t);
    if (brand) await recordReferral(brand.id, assistant, p);
  }
  return new Response(null, { status: 204, headers: CORS });
}

export const GET = handle;
export const POST = handle;
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
