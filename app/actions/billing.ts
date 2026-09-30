"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireOrg, requireUser } from "@/lib/auth";
import { BILLABLE, billingConfigured, priceFor, stripe, type Interval } from "@/lib/billing";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import type { PlanId } from "@/lib/plans";
import { appUrl } from "@/lib/url";

async function billingOwner(orgId: string) {
  const user = await requireUser();
  const access = await requireOrg(user, orgId);
  if (access.role !== "owner") throw new Error("Only workspace owners can manage billing");
  if (!billingConfigured()) throw new Error("Billing isn't set up yet");
  return { user, ...access };
}

/** Sends the owner to Stripe Checkout, or to the billing portal if they already subscribe. */
export async function startCheckout(orgId: string, plan: PlanId, interval: Interval) {
  const { user, org } = await billingOwner(orgId);
  if (!BILLABLE.includes(plan) || (interval !== "month" && interval !== "year")) throw new Error("That plan can't be bought online");
  const base = await appUrl();

  // Existing subscribers change plans in the portal so Stripe prorates correctly.
  if (org.stripeSubscriptionId && org.subscriptionStatus && org.subscriptionStatus !== "canceled") {
    return openBillingPortal(orgId);
  }

  let customer = org.stripeCustomerId;
  if (!customer) {
    const created = await stripe().customers.create({
      email: user.email,
      name: org.name,
      metadata: { orgId: org.id },
    });
    customer = created.id;
    await db.update(organizations).set({ stripeCustomerId: customer }).where(eq(organizations.id, org.id));
  }

  const price = await priceFor(plan, interval);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: org.id,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: { metadata: { orgId: org.id } },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${base}/app/o/${org.id}/billing?success=1`,
    cancel_url: `${base}/app/o/${org.id}/billing?canceled=1`,
  });
  redirect(session.url!);
}

export async function openBillingPortal(orgId: string) {
  const { org } = await billingOwner(orgId);
  if (!org.stripeCustomerId) redirect(`/app/o/${orgId}/billing`);
  // Use the portal set up by `npm run stripe:setup` (allows switching Pro ⇄ Agency); fall back to Stripe's default.
  const configs = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const configuration = configs.data.find((c) => c.metadata?.aeo_portal === "1")?.id;
  const session = await stripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    ...(configuration ? { configuration } : {}),
    return_url: `${await appUrl()}/app/o/${orgId}/billing`,
  });
  redirect(session.url);
}
