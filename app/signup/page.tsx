import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { SiteHeader } from "@/app/components/site-header";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Start free · AEO GrowthLead" };

export default async function SignupPage() {
  if (await getUser()) redirect("/app");
  return (
    <>
      <SiteHeader />
      <main className="auth-card card">
        <h1>Start tracking your AI visibility</h1>
        <p className="muted">Free forever for 1 brand and 10 prompts. No card required.</p>
        <ActionForm action={signup}>
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
