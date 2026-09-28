import { count, desc, gt, ne } from "drizzle-orm";
import Link from "next/link";
import { createClientOrg, updateOrgPlan } from "@/app/actions/work";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands, organizations, runs, tasks } from "@/lib/db/schema";
import { PLANS } from "@/lib/plans";
import { dataForSeoConfigured } from "@/lib/tracking/dataforseo";

export const metadata = { title: "Admin · AEOGrowthLeads" };

export default async function AdminPage() {
  await requireStaff();
  const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  const brandCounts = await db.select({ orgId: brands.orgId, n: count() }).from(brands).groupBy(brands.orgId);
  const openTasks = await db
    .select({ orgId: tasks.orgId, n: count() })
    .from(tasks)
    .where(ne(tasks.status, "done"))
    .groupBy(tasks.orgId);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const spend = await db.select({ cost: runs.cost }).from(runs).where(gt(runs.startedAt, since));
  const monthSpend = spend.reduce((n, r) => n + r.cost, 0);
  const mrr = orgs.reduce((n, o) => n + (PLANS[o.plan as keyof typeof PLANS]?.monthly ?? 0), 0);
  const byOrg = <T extends { orgId: string; n: number }>(rows: T[], id: string) => rows.find((r) => r.orgId === id)?.n ?? 0;

  return (
      <main className="wrap page stack-lg">
        <div className="page-head">
          <div>
            <h1>Admin</h1>
            <p className="muted">All workspaces, plans and done-for-you clients.</p>
          </div>
        </div>
        {!dataForSeoConfigured() && (
          <div className="notice">
            DataForSEO isn&apos;t connected yet, so tracking uses simulated answers. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD
            in Hostinger&apos;s environment variables.
          </div>
        )}
        <section className="stats">
          <div className="stat">
            <div className="label">Workspaces</div>
            <div className="value">{orgs.length}</div>
          </div>
          <div className="stat">
            <div className="label">Done-for-you clients</div>
            <div className="value">{orgs.filter((o) => o.doneForYou).length}</div>
          </div>
          <div className="stat">
            <div className="label">List-price MRR</div>
            <div className="value">${mrr.toLocaleString()}</div>
          </div>
          <div className="stat">
            <div className="label">DataForSEO spend, 30 days</div>
            <div className="value">${monthSpend.toFixed(2)}</div>
          </div>
        </section>

        <section className="card">
          <h2>Workspaces</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Brands</th>
                  <th>Open tasks</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/app/o/${o.id}`}>
                        <b>{o.name}</b>
                      </Link>
                      {o.doneForYou && (
                        <>
                          {" "}
                          <Link href={`/app/o/${o.id}/work`} className="tag">
                            DFY work
                          </Link>
                        </>
                      )}
                      <div className="muted small">since {o.createdAt.toLocaleDateString()}</div>
                    </td>
                    <td className="num">{byOrg(brandCounts, o.id)}</td>
                    <td className="num">{byOrg(openTasks, o.id)}</td>
                    <td>
                      <form action={updateOrgPlan.bind(null, o.id)} className="inline-form">
                        <select name="plan" defaultValue={o.plan} aria-label="Plan">
                          {Object.values(PLANS).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.monthly})
                            </option>
                          ))}
                        </select>
                        <label className="check-label small">
                          <input type="checkbox" name="doneForYou" defaultChecked={o.doneForYou} /> DFY
                        </label>
                        <SubmitButton className="btn ghost small">Save</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card narrow">
          <h2>Add a client workspace</h2>
          <p className="muted small">
            For done-for-you clients or customers you onboard by hand. Done-for-you clients get a view-only portal login.
          </p>
          <ActionForm action={createClientOrg} resetOnSuccess>
            <div className="field-row">
              <input name="name" placeholder="Client business name" required />
              <select name="plan" defaultValue="dfy" aria-label="Plan">
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${p.monthly}/mo)
                  </option>
                ))}
              </select>
            </div>
            <label className="check-label">
              <input type="checkbox" name="doneForYou" defaultChecked /> Done-for-you client
            </label>
            <div className="field-row">
              <input name="ownerName" placeholder="Client contact name (optional)" />
              <input name="ownerEmail" type="email" placeholder="Client email (optional)" />
            </div>
            <input name="ownerPassword" type="text" placeholder="Temporary password (optional; blank = email an invite)" />
            <SubmitButton>Create workspace</SubmitButton>
          </ActionForm>
        </section>
      </main>
  );
}
