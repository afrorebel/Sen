// Creates the AEO GrowthLead products and prices in Stripe (idempotent: existing lookup keys are skipped).
//   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
// Run once with your test key and once with your live key.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first");
  process.exit(1);
}
const stripe = new Stripe(key);

// Keep in sync with lib/plans.ts (prices in USD). Done For You is quote-only, so it has no price here.
const PLANS = [
  { id: "pro", name: "AEO GrowthLead Pro", month: 79, year: 790 },
  { id: "agency", name: "AEO GrowthLead Agency", month: 249, year: 2490 },
];
const products = [];

for (const plan of PLANS) {
  const wanted = [
    { interval: "month", amount: plan.month * 100 },
    { interval: "year", amount: plan.year * 100 },
  ];
  const lookupKeys = wanted.map((w) => `aeo_${plan.id}_${w.interval}`);
  const existing = await stripe.prices.list({ lookup_keys: lookupKeys, limit: 10 });
  const have = new Set(existing.data.map((p) => p.lookup_key));
  if (wanted.every((w) => have.has(`aeo_${plan.id}_${w.interval}`))) {
    console.log(`✓ ${plan.name}: prices already exist`);
    const product = existing.data[0].product;
    products.push({ product: typeof product === "string" ? product : product.id, prices: existing.data.map((p) => p.id) });
    continue;
  }

  const found = await stripe.products.search({ query: `metadata['aeo_plan']:'${plan.id}'` });
  const product =
    found.data[0] ?? (await stripe.products.create({ name: plan.name, metadata: { aeo_plan: plan.id } }));

  const priceIds = existing.data.map((p) => p.id);
  for (const w of wanted) {
    const lookup_key = `aeo_${plan.id}_${w.interval}`;
    if (have.has(lookup_key)) continue;
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: w.amount,
      recurring: { interval: w.interval },
      lookup_key,
      transfer_lookup_key: true,
    });
    priceIds.push(price.id);
    console.log(`+ ${plan.name}: ${lookup_key} = $${w.amount / 100}/${w.interval}`);
  }
  products.push({ product: product.id, prices: priceIds });
}

// Customer portal: cards, invoices, cancellation, and switching between Pro and Agency (monthly or yearly).
const base = process.env.APP_URL ?? "https://app.aeogrowthlead.com";
const portal = {
  metadata: { aeo_portal: "1" },
  business_profile: { headline: "AEO GrowthLead billing" },
  default_return_url: `${base}/app`,
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price", "promotion_code"],
      proration_behavior: "create_prorations",
      products,
    },
  },
};
const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
const mine = configs.data.find((c) => c.metadata?.aeo_portal === "1");
if (mine) await stripe.billingPortal.configurations.update(mine.id, portal);
else await stripe.billingPortal.configurations.create(portal);
console.log("✓ Customer portal configured (plan switching, invoices, cards, cancellation)");
console.log("Done. Next: add the webhook endpoint https://app.aeogrowthlead.com/api/stripe/webhook in Stripe.");
