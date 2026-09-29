import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Small in-memory cache so repeated source chips don't refetch.
const cache = new Map<string, { body: ArrayBuffer; type: string; at: number }>();
const DAY = 86_400_000;
const FALLBACK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="#7C8798" stroke-width="1.5"/><path d="M1 8h14M8 1c2 2 2 12 0 14M8 1c-2 2-2 12 0 14" fill="none" stroke="#7C8798" stroke-width="1.2"/></svg>';

/** GET /api/favicon?domain=example.com → that site's favicon (via Google's favicon service), cached for a day. */
export async function GET(request: Request) {
  const domain = (new URL(request.url).searchParams.get("domain") ?? "").toLowerCase();
  if (!/^[a-z0-9.-]{3,253}$/.test(domain)) return new NextResponse(FALLBACK, { headers: { "content-type": "image/svg+xml" } });

  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < DAY) {
    return new NextResponse(hit.body, { headers: { "content-type": hit.type, "cache-control": "public, max-age=86400" } });
  }
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.arrayBuffer();
    const type = res.headers.get("content-type") ?? "image/png";
    if (cache.size > 2000) cache.clear();
    cache.set(domain, { body, type, at: Date.now() });
    return new NextResponse(body, { headers: { "content-type": type, "cache-control": "public, max-age=86400" } });
  } catch {
    return new NextResponse(FALLBACK, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
  }
}
