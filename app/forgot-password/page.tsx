import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/password";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { SiteHeader } from "@/app/components/site-header";

export const metadata = { title: "Reset password · AEOGrowthLeads" };

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main className="auth-card card">
        <h1>Forgot your password?</h1>
        <p className="muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
        <ActionForm action={requestPasswordReset}>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
        </ActionForm>
        <p className="muted">
          Remembered it? <Link href="/login">Back to log in</Link>
        </p>
      </main>
    </>
  );
}
