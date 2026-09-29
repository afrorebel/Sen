import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { SiteHeader } from "@/app/components/site-header";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Log in · AEO GrowthLead" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getUser()) redirect("/app");
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="auth-card card">
        <h1>Log in</h1>
        <ActionForm action={login}>
          <input type="hidden" name="next" value={next ?? ""} />
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span className="row-between">
              Password
              <Link href="/forgot-password" className="small">
                Forgot password?
              </Link>
            </span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
        </ActionForm>
        <p className="muted">
          New here? <Link href="/signup">Create a free account</Link>
        </p>
      </main>
    </>
  );
}
