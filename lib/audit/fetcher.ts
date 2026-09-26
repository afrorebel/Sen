import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { PageSnapshot } from "./types";

export const USER_AGENT =
  "Mozilla/5.0 (compatible; SenAEOAudit/0.1; +https://github.com/afrorebel/sen)";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class FetchError extends Error {}

/** Normalises user input like "example.com" into an absolute https URL. */
export function normalizeUrl(input: string): URL {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError(`"${input}" is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("Only http and https URLs can be audited");
  }
  if (url.username || url.password) {
    throw new FetchError("URLs with credentials are not allowed");
  }
  url.hash = "";
  return url;
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIP(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIPv4(v6.slice(7));
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80") ||
    v6.startsWith("ff")
  );
}

/**
 * Blocks requests to loopback / private / link-local addresses so the audit
 * endpoint can't be used to probe internal infrastructure (SSRF).
 */
async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FetchError("Private hosts cannot be audited");
  }
  if (isIP(host)) {
    if (isPrivateIP(host)) throw new FetchError("Private IP addresses cannot be audited");
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new FetchError(`Could not resolve ${host}`);
  }
  if (addresses.some((a) => isPrivateIP(a.address))) {
    throw new FetchError("Host resolves to a private address and cannot be audited");
  }
}

async function readCapped(res: Response): Promise<{ text: string; bytes: number }> {
  if (!res.body) return { text: "", bytes: 0 };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
  return { text, bytes };
}

export interface FetchOptions {
  timeoutMs?: number;
  userAgent?: string;
}

/** GET a URL, following redirects manually so every hop passes the SSRF check. */
export async function fetchPage(
  input: string | URL,
  { timeoutMs = 15000, userAgent = USER_AGENT }: FetchOptions = {},
): Promise<PageSnapshot> {
  let url = typeof input === "string" ? normalizeUrl(input) : input;
  const started = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    }).catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err);
      throw new FetchError(`Could not fetch ${url.href}: ${reason}`);
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new FetchError("Redirected to an unsupported protocol");
      }
      continue;
    }

    const { text, bytes } = await readCapped(res);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    return {
      url: typeof input === "string" ? input : input.href,
      finalUrl: url.href,
      status: res.status,
      responseMs: Date.now() - started,
      bytes,
      headers,
      html: text,
    };
  }
  throw new FetchError("Too many redirects");
}

/** Like fetchPage but never throws — returns null for network errors or non-2xx. */
export async function tryFetch(url: string | URL, opts?: FetchOptions): Promise<PageSnapshot | null> {
  try {
    const page = await fetchPage(url, opts);
    return page.status >= 200 && page.status < 300 ? page : null;
  } catch {
    return null;
  }
}
