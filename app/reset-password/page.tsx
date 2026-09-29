import Link from "next/link";
import { resetPassword } from "@/app/actions/password";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { SiteHeader } from "@/app/components/site-header";
import { findPasswordToken } from "@/lib/auth";

export const metadata = { title: "Choose a new password · AEO GrowthLead" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const found = token ? await findPasswordToken(token) : null;
  return (
    <>
      <SiteHeader />
      <main className="auth-card card">
        {found ? (
          <>
            <h1>Choose a new password</h1>
            <p className="muted">For {found.user.email}</p>
            <ActionForm action={resetPassword.bind(null, token)}>
              <label>
                New password
                <input name="password" type="password" autoComplete="new-password" minLength={8} required />
              </label>
              <label>
                Confirm new password
                <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
              </label>
              <SubmitButton pendingText="Saving…">Save password and log in</SubmitButton>
            </ActionForm>
          </>
        ) : (
          <>
            <h1>This link has expired</h1>
            <p className="muted">
              Password links work once and expire after a while. Request a fresh one and use the newest email.
            </p>
            <Link href="/forgot-password" className="btn">
              Send a new link
            </Link>
          </>
        )}
      </main>
    </>
  );
}
