import { changePassword } from "@/app/actions/password";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Account · AEOGrowthLeads" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="wrap page stack-lg narrow">
      <div>
        <h1>Your account</h1>
        <p className="muted">
          {user.name} · {user.email}
        </p>
      </div>
      <section className="card">
        <h2>Change password</h2>
        <ActionForm action={changePassword} resetOnSuccess>
          <label>
            Current password
            <input name="current" type="password" autoComplete="current-password" required />
          </label>
          <div className="field-row">
            <label>
              New password
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <label>
              Confirm new password
              <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </label>
          </div>
          <SubmitButton pendingText="Saving…">Update password</SubmitButton>
        </ActionForm>
      </section>
    </main>
  );
}
