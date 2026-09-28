import { and, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { Empty, pct } from "@/app/components/ui";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands, deliverables, tasks } from "@/lib/db/schema";
import { planFor } from "@/lib/plans";
import { brandVisibility } from "@/lib/tracking/metrics";

export default async function OrgHome({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const { org, canEdit, role } = await requireOrg(user, orgId);
  const plan = planFor(org.plan);
  const base = `/app/o/${orgId}`;

  const brandRows = await db.select().from(brands).where(eq(brands.orgId, orgId)).orderBy(brands.createdAt);
  const summaries = await Promise.all(brandRows.map(async (b) => ({ brand: b, vis: await brandVisibility(b.id, 2) })));

  const clientOnly = role === "client" && !user.isStaff;
  const openTasks = org.doneForYou
    ? await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.orgId, orgId), ne(tasks.status, "done"), clientOnly ? eq(tasks.clientVisible, true) : undefined))
        .orderBy(tasks.dueDate)
        .limit(5)
    : [];
  const recent = org.doneForYou
    ? await db.select().from(deliverables).where(eq(deliverables.orgId, orgId)).orderBy(desc(deliverables.deliveredAt)).limit(5)
    : [];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Brands</h1>
          <p className="muted">
            {brandRows.length} of {plan.brands} brand{plan.brands > 1 ? "s" : ""} on the {plan.name} plan
          </p>
        </div>
        {canEdit && brandRows.length < plan.brands && (
          <Link href={`${base}/brands/new`} className="btn">
            Add brand
          </Link>
        )}
      </div>

      {brandRows.length === 0 ? (
        <Empty title={canEdit ? "Add your first brand" : "Your tracking is being set up"}>
          <p className="muted">
            {canEdit
              ? "Tell us your website and the questions buyers ask. We'll check what AI engines say about you."
              : "Our team is adding your brand and buyer prompts. Results will appear here after the first check."}
          </p>
          {canEdit && (
            <Link href={`${base}/brands/new`} className="btn">
              Add brand
            </Link>
          )}
        </Empty>
      ) : (
        <div className="grid-cards">
          {summaries.map(({ brand, vis }) => (
            <Link key={brand.id} href={`${base}/b/${brand.id}`} className="card link-card">
              <h3>{brand.name}</h3>
              <p className="muted small">{brand.domain}</p>
              {vis.latest ? (
                <div className="mini-stats">
                  <div>
                    <b>{pct(vis.latest.mentionRate)}</b>
                    <span>mentioned</span>
                  </div>
                  <div>
                    <b>{pct(vis.latest.citationRate)}</b>
                    <span>cited</span>
                  </div>
                  <div>
                    <b>{pct(vis.latest.shareOfVoice)}</b>
                    <span>share of voice</span>
                  </div>
                </div>
              ) : (
                <p className="muted small">First results are on the way.</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {org.doneForYou && (
        <section className="two-col">
          <div className="card">
            <div className="page-head">
              <h2>In progress</h2>
              <Link href={`${base}/work`} className="small">
                All work →
              </Link>
            </div>
            {openTasks.length ? (
              <ul className="list">
                {openTasks.map((t) => (
                  <li key={t.id}>
                    <span className={`status-dot ${t.status}`} aria-hidden />
                    {t.title}
                    <span className="muted small"> · {t.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No open tasks right now.</p>
            )}
          </div>
          <div className="card">
            <h2>Recently delivered</h2>
            {recent.length ? (
              <ul className="list">
                {recent.map((d) => (
                  <li key={d.id}>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer">
                        {d.title}
                      </a>
                    ) : (
                      d.title
                    )}
                    <span className="muted small"> · {d.deliveredAt.toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Deliverables will appear here as our team ships them.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
