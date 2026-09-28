import "server-only";
import { headers } from "next/headers";

/** Public base URL for links in emails and Stripe redirects. Set APP_URL in production. */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}
