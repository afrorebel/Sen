import { and, count, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { openBillingPortal, startCheckout } from "@/app/actions/billing";
import { SubmitButton } from "@/app/components/forms";
import { requireOrg, requireUser } from "@/lib/auth";
import { BILLABLE, billingConfigured, type Interval } from "@/lib/billing";
import { db } from "@/lib/db";
import { brands, prompts } from "@/lib/db/schema";
import { PLANS, planFor, type PlanId } from "@/lib/plans";

export const metadata = { title: "Billing · AEO GrowthLead" };

const STATUS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed. Update your card to keep tracking.",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Waiting for payment",
};

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const ratio = Math.min(used / Math.max(limit, 1), 1);
  const tone = ratio >= 1 ? "var(--critical)" : ratio >= 0.8 ? "var(--warning)" : "var(--accent)";
  return (
    <div className="usage">
      <div className="row-between small">
        <span>{label}</span>
        <span className="num">
          {used} / {limit}
        </span>
      </div>
      <div className="meter" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={label}>
        <span style={{ width: `${ratio * 100}%`, background: tone }} />
      </div>
    </div>
  );
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ interval?: string; success?: string; canceled?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const interval: Interval = sp.interval === "year" ? "year" : "month";
  const user = await requireUser();
  const { org, role } = await requireOrg(user, orgId);
  if (role !== "owner") redirect(`/app/o/${orgId}`);
  const plan = planFor(org.plan);
  const configured = billingConfigured();

  const [{ n: brandCount }] = await db.select({ n: count() }).from(brands).where(eq(brands.orgId, orgId));
  const [{ n: promptCount }] = await db
    .select({ n: count() })
    .from(prompts)
    .innerJoin(brands, eq(brands.id, prompts.brandId))
    .where(and(eq(brands.orgId, orgId), eq(prompts.active, true)));

  const subscribed = Boolean(org.stripeSubscriptionId && org.subscriptionStatus && org.subscriptionStatus !== "canceled");
  const options = (Object.keys(BILLABLE) as PlanId[]).filter((id) => id !== "dfy");
  const base = `/app/o/${orgId}/billing`;

  return (
    <div className="stack-lg">
      <div>
        <h1>Billing</h1>
        <p className="muted">Manage your plan, payment method and invoices.</p>
      </div>

      {sp.success && (
        <div className="form-msg ok">Thanks! Your subscription is active. It can take a few seconds for the new limits to appear.</div>
      )}
      {sp.canceled && <div className="notice">Checkout was canceled. You haven&apos;t been charged.</div>}
      {org.subscriptionStatus === "past_due" && <div className="form-msg error">{STATUS.past_due}</div>}
      {!configured && (
        <div className="notice">
          Online payments aren&apos;t switched on yet.{" "}
          {user.isStaff
            ? "Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (see DEPLOY-HOSTINGER.md). You can still set plans on the Admin page."
            : "Email hello@aeogrowthlead.com to change your plan."}
        </div>
      )}

      <section className="two-col">
        <div className="card">
          <p className="eyebrow">Current plan</p>
          <h2 style={{ fontSize: 28, margin: "4px 0" }}>{plan.name}</h2>
          <p className="muted">
            {plan.monthly ? `$${org.billingInterval === "year" ? plan.annualMonthly : plan.monthly}/mo` : "Free"}
            {org.billingInterval === "year" && " billed annually"}
            {org.subscriptionStatus && ` · ${STATUS[org.subscriptionStatus] ?? org.subscriptionStatus}`}
          </p>
          {org.currentPeriodEnd && (
            <p className="small">
              {org.cancelAtPeriodEnd ? "Ends" : "Renews"} on {org.currentPeriodEnd.toLocaleDateString(undefined, { dateStyle: "long" })}
            </p>
          )}
          {subscribed && configured && (
            <form action={openBillingPortal.bind(null, orgId)}>
              <SubmitButton className="btn ghost" pendingText="Opening Stripe…">
                Manage billing, cards &amp; invoices
              </SubmitButton>
            </form>
          )}
        </div>
        <div className="card stack">
          <p className="eyebrow">Usage</p>
          <Meter label="Brands" used={brandCount} limit={plan.brands} />
          <Meter label="Tracked prompts" used={promptCount} limit={plan.prompts} />
          <p className="muted small">
            {plan.engineSlots} AI engines per brand · {plan.frequencies.includes("daily") ? "daily or weekly" : "weekly"} checks
          </p>
        </div>
      </section>

      <section className="stack">
        <div className="row-between">
          <h2 style={{ margin: 0 }}>{subscribed ? "Change plan" : "Upgrade"}</h2>
          <nav className="segmented" aria-label="Billing interval">
            <Link href={base} aria-current={interval === "month" ? "true" : undefined}>
              Monthly
            </Link>
            <Link href={`${base}?interval=year`} aria-current={interval === "year" ? "true" : undefined}>
              Annual <span className="save">save 20%</span>
            </Link>
          </nav>
        </div>
        <div className="plans">
          {options.map((id) => {
            const p = PLANS[id];
            const current = org.plan === id && (org.billingInterval ?? "month") === interval;
            return (
              <div key={id} className={`plan card ${p.highlight ? "featured" : ""}`}>
                {p.highlight && <div className="ribbon">Most popular</div>}
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <div className="price">
                  ${interval === "year" ? p.annualMonthly : p.monthly}
                  <span>/mo</span>
                </div>
                <p className="muted small">
                  {interval === "year" ? `$${(p.annualMonthly * 12).toLocaleString("en-US")} billed yearly` : "billed monthly"}
                </p>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {current ? (
                  <span className="btn ghost" aria-disabled>
                    Current plan
                  </span>
                ) : (
                  <form action={startCheckout.bind(null, orgId, id, interval)}>
                    <SubmitButton className={`btn ${p.highlight ? "" : "ghost"} full`} pendingText="Opening checkout…">
                      {configured ? (subscribed ? `Switch to ${p.name}` : `Choose ${p.name}`) : "Coming soon"}
                    </SubmitButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <div className="card dfy-band">
          <div>
            <p className="eyebrow">Done For You</p>
            <h3 style={{ margin: "4px 0" }}>Want our team to do the work?</h3>
            <p className="muted">
              Technical fixes, schema, answer-first articles and a monthly share-of-voice report, all tracked right here.
            </p>
          </div>
          <div className="dfy-price">
            <div className="price">
              ${PLANS.dfy.monthly}
              <span>/mo</span>
            </div>
            {org.plan === "dfy" ? (
              <span className="btn ghost">Current plan</span>
            ) : (
              <form action={startCheckout.bind(null, orgId, "dfy", "month")}>
                <SubmitButton className="btn full" pendingText="Opening checkout…">
                  {configured ? "Start Done For You" : "Coming soon"}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
