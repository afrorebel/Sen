import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { addMember, removeMember } from "@/app/actions/work";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";

export const metadata = { title: "Team & clients · AEOGrowthLeads" };

const ROLE_LABEL = { owner: "Owner", member: "Team member", client: "Client (view only)" };

export default async function TeamPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const { role } = await requireOrg(user, orgId);
  if (role !== "owner") redirect(`/app/o/${orgId}`);
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
                    {p.isStaff && <span className="tag">AEOGrowthLeads team</span>}
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
        <h2>Add a person</h2>
        <ActionForm action={addMember.bind(null, orgId)} resetOnSuccess>
          <div className="field-row">
            <input name="name" placeholder="Full name" required />
            <input name="email" type="email" placeholder="Email" required />
          </div>
          <div className="field-row">
            <select name="role" defaultValue="client" aria-label="Access">
              <option value="client">Client (view only)</option>
              <option value="member">Team member (can edit)</option>
            </select>
            <input name="password" type="text" placeholder="Temporary password (8+ characters)" minLength={8} required />
          </div>
          <p className="hint">Share the email and temporary password with them. Existing accounts are simply added.</p>
          <SubmitButton>Add person</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
