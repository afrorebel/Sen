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

// Keep in sync with lib/plans.ts (prices in USD).
const PLANS = [
  { id: "starter", name: "AEO GrowthLead Starter", month: 49, yearPerMonth: 39 },
  { id: "growth", name: "AEO GrowthLead Growth", month: 129, yearPerMonth: 103 },
  { id: "agency", name: "AEO GrowthLead Agency", month: 349, yearPerMonth: 279 },
  { id: "dfy", name: "AEO GrowthLead Done For You", month: 799 },
];

for (const plan of PLANS) {
  const wanted = [
    { interval: "month", amount: plan.month * 100 },
    ...(plan.yearPerMonth ? [{ interval: "year", amount: plan.yearPerMonth * 12 * 100 }] : []),
  ];
  const lookupKeys = wanted.map((w) => `aeo_${plan.id}_${w.interval}`);
  const existing = await stripe.prices.list({ lookup_keys: lookupKeys, limit: 10 });
  const have = new Set(existing.data.map((p) => p.lookup_key));
  if (wanted.every((w) => have.has(`aeo_${plan.id}_${w.interval}`))) {
    console.log(`✓ ${plan.name}: prices already exist`);
    continue;
  }

  const found = await stripe.products.search({ query: `metadata['aeo_plan']:'${plan.id}'` });
  const product =
    found.data[0] ?? (await stripe.products.create({ name: plan.name, metadata: { aeo_plan: plan.id } }));

  for (const w of wanted) {
    const lookup_key = `aeo_${plan.id}_${w.interval}`;
    if (have.has(lookup_key)) continue;
    await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: w.amount,
      recurring: { interval: w.interval },
      lookup_key,
      transfer_lookup_key: true,
    });
    console.log(`+ ${plan.name}: ${lookup_key} = $${w.amount / 100}/${w.interval}`);
  }
}
console.log("Done. Next: add the webhook endpoint https://app.aeogrowthlead.com/api/stripe/webhook in Stripe.");
