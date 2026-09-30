import "server-only";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "./db";
import { organizations } from "./db/schema";
import { syncBrandsToPlan } from "./limits";
import { planFor, type PlanId } from "./plans";

export type Interval = "month" | "year";

/** Plans that can be bought online. Done For You is quote-only and assigned by staff. */
export const BILLABLE: PlanId[] = ["pro", "agency"];

/**
 * Prices are found by lookup key rather than hard-coded price IDs, so the same code works in
 * Stripe test and live mode. `npm run stripe:setup` creates them.
 */
export const lookupKey = (plan: PlanId, interval: Interval) => `aeo_${plan}_${interval}`;

export function parseLookupKey(key: string | null | undefined): { plan: PlanId; interval: Interval } | null {
  const m = key?.match(/^aeo_([a-z]+)_(month|year)$/);
  if (!m) return null;
  // planFor maps retired plan ids (starter, growth) onto the current ones; unknown ids fall back to free.
  const plan = planFor(m[1]).id;
  if (plan === "free") return null;
  return { plan, interval: m[2] as Interval };
}

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export async function priceFor(plan: PlanId, interval: Interval): Promise<Stripe.Price> {
  const { data } = await stripe().prices.list({ lookup_keys: [lookupKey(plan, interval)], active: true, limit: 1 });
  if (!data[0]) throw new Error(`No Stripe price with lookup key ${lookupKey(plan, interval)}. Run npm run stripe:setup.`);
  return data[0];
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

/**
 * Applies a Stripe subscription to its workspace. Called from the webhook for
 * created/updated/deleted events. It needs no extra API calls, so it's safe to replay.
 */
export async function applySubscription(sub: Stripe.Subscription): Promise<string | null> {
  const orgId = sub.metadata?.orgId;
  if (!orgId) return null;
  const item = sub.items.data[0];
  const parsed = parseLookupKey(item?.price?.lookup_key);
  const live = ACTIVE.has(sub.status);

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return null;
  // Ignore events for an older subscription after the customer switched to a new one.
  if (org.stripeSubscriptionId && org.stripeSubscriptionId !== sub.id && sub.status === "canceled") return orgId;

  // Done For You is assigned by staff after a sales call; subscription events never change it.
  const plan: PlanId = org.plan === "dfy" ? "dfy" : live && parsed ? parsed.plan : "free";
  await db
    .update(organizations)
    .set({
      plan,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      billingInterval: parsed?.interval ?? null,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .where(eq(organizations.id, orgId));
  const before = planFor(org.plan).id;
  if (before !== plan) await syncBrandsToPlan(orgId, plan, RANK[plan] > RANK[before]);
  return orgId;
}

const RANK: Record<PlanId, number> = { free: 0, pro: 1, agency: 2, dfy: 3 };
