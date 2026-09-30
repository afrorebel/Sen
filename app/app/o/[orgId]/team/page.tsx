import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { addMember, removeMember, updateWhiteLabel } from "@/app/actions/work";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { UpgradeNote } from "@/app/components/gate";
import { seatsUsed } from "@/lib/limits";
import { hasFeature, planFor } from "@/lib/plans";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";

export const metadata = { title: "Team & clients · AEO GrowthLead" };

const ROLE_LABEL = { owner: "Owner", member: "Team member", client: "Client (view only)" };

export default async function TeamPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const { role, org } = await requireOrg(user, orgId);
  if (role !== "owner") redirect(`/app/o/${orgId}`);
  const plan = planFor(org.plan);
  const seats = await seatsUsed(orgId);
  const seatsFull = plan.seats !== null && seats >= plan.seats;
  const portal = hasFeature(org.plan, "clientPortal");
  const whiteLabel = hasFeature(org.plan, "whiteLabel");
  const billing = `/app/o/${orgId}/billing`;
  const people = await db
    .select({ id: users.id, name: users.name, email: users.email, isStaff: users.isStaff, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(users.name);

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>Team &amp; clients</h1>
        <p className="muted">
          Add teammates who can edit, or give a client a view-only portal login to follow their results and deliverables.
        </p>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.isStaff && <span className="tag">AEO GrowthLead team</span>}
                  </td>
                  <td>{p.email}</td>
                  <td>{ROLE_LABEL[p.role]}</td>
                  <td>
                    {p.id !== user.id && (
                      <form action={removeMember.bind(null, orgId, p.id)}>
                        <button className="linklike muted small">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="row-between">
          <h2>Add a person</h2>
          <span className="muted small">
            {plan.seats === null ? "Unlimited team seats" : `${seats} of ${plan.seats} team seat${plan.seats === 1 ? "" : "s"} used`}
          </span>
        </div>
        {seatsFull && !portal ? (
          <UpgradeNote billingHref={billing} canUpgrade>
            Your {plan.name} plan includes {plan.seats} team seat{plan.seats === 1 ? "" : "s"}. Upgrade to add teammates{plan.id === "free" ? "" : " or client logins"}.
          </UpgradeNote>
        ) : (
          <ActionForm action={addMember.bind(null, orgId)} resetOnSuccess>
            <div className="field-row">
              <input name="name" placeholder="Full name" required />
              <input name="email" type="email" placeholder="Email" required />
            </div>
            <div className="field-row">
              <select name="role" defaultValue={portal ? "client" : "member"} aria-label="Access">
                <option value="member" disabled={seatsFull}>
                  Team member (can edit){seatsFull ? " (no seats left)" : ""}
                </option>
                <option value="client" disabled={!portal}>
                  Client (view only){portal ? "" : " (Agency)"}
                </option>
              </select>
              <input name="password" type="text" placeholder="Temporary password (optional)" minLength={8} />
            </div>
            <p className="hint">Leave the password blank to email them an invite link to set their own. Existing accounts are simply added.</p>
            <SubmitButton>Add person</SubmitButton>
          </ActionForm>
        )}
        {!portal && (
          <UpgradeNote billingHref={billing} canUpgrade>
            Give clients their own view-only login with the Agency plan.
          </UpgradeNote>
        )}
      </section>

      <section className="card" id="white-label">
        <h2>White-label reports</h2>
        <p className="muted small">Put your agency&apos;s name and logo on monthly PDF reports and report emails instead of ours.</p>
        {whiteLabel ? (
          <ActionForm action={updateWhiteLabel.bind(null, orgId)}>
            <label>
              Prepared by
              <input name="reportName" defaultValue={org.reportName ?? ""} placeholder="Your agency name" maxLength={80} />
            </label>
            <div className="wl-logo">
              {org.reportLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.reportLogo} alt="Current report logo" />
              ) : (
                <span className="muted small">No logo yet</span>
              )}
              <label className="small">
                Logo (PNG or JPEG, under 300 KB)
                <input type="file" name="reportLogo" accept="image/png,image/jpeg" />
              </label>
              {org.reportLogo && (
                <label className="check-label small">
                  <input type="checkbox" name="removeLogo" /> Remove logo
                </label>
              )}
            </div>
            <SubmitButton>Save branding</SubmitButton>
          </ActionForm>
        ) : (
          <UpgradeNote billingHref={billing} canUpgrade>
            White-label reports are included in the Agency plan.
          </UpgradeNote>
        )}
      </section>
    </div>
  );
}
