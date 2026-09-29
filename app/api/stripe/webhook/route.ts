import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { applySubscription, stripe } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe → Dashboard → Developers → Webhooks → add endpoint
 *   https://app.aeogrowthlead.com/api/stripe/webhook
 * Events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await applySubscription(event.data.object);
      break;
  }
  return NextResponse.json({ received: true });
}
