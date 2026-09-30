import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { SiteHeader } from "@/app/components/site-header";
import { getUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Start free · AEO GrowthLead" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; billing?: string }> }) {
  const sp = await searchParams;
  const chosen = sp.plan === "pro" || sp.plan === "agency" ? PLANS[sp.plan] : null;
  const billing = sp.billing === "year" ? "year" : "month";
  if (await getUser()) redirect("/app");
  return (
    <>
      <SiteHeader />
      <main className="auth-card card">
        <h1>{chosen ? `Start with ${chosen.name}` : "Start tracking your AI visibility"}</h1>
        <p className="muted">
          {chosen
            ? `Create your account, then check out: $${billing === "year" ? `${chosen.yearly!.toLocaleString("en-US")}/year` : `${chosen.monthly}/month`}. Cancel any time.`
            : `Free forever for ${PLANS.free.brands} brand and ${PLANS.free.prompts} prompts. No card required.`}
        </p>
        <ActionForm action={signup}>
          {chosen && (
            <>
              <input type="hidden" name="plan" value={chosen.id} />
              <input type="hidden" name="billing" value={billing} />
            </>
          )}
          <label>
            Your name
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            Company
            <input name="company" autoComplete="organization" required />
          </label>
          <label>
            Work email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
        </ActionForm>
        <p className="muted">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </main>
    </>
  );
}
