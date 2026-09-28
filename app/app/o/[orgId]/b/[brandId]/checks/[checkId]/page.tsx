import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/app/components/ui";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands, checks, prompts } from "@/lib/db/schema";
import { ENGINES, isEngine } from "@/lib/tracking/engines";

export default async function CheckPage({ params }: { params: Promise<{ orgId: string; brandId: string; checkId: string }> }) {
  const { orgId, brandId, checkId } = await params;
  const user = await requireUser();
  await requireOrg(user, orgId);
  const [row] = await db
    .select({ check: checks, prompt: prompts, brand: brands })
    .from(checks)
    .innerJoin(prompts, eq(prompts.id, checks.promptId))
    .innerJoin(brands, eq(brands.id, checks.brandId))
    .where(and(eq(checks.id, checkId), eq(checks.brandId, brandId), eq(brands.orgId, orgId)))
    .limit(1);
  if (!row) notFound();
  const { check, prompt, brand } = row;
  const engine = isEngine(check.engine) ? ENGINES[check.engine].label : check.engine;

  return (
    <div className="stack-lg narrow">
      <p className="muted small">
        <Link href={`/app/o/${orgId}/b/${brandId}?tab=prompts`}>← {brand.name} prompts</Link>
      </p>
      <div>
        <p className="eyebrow">{engine}</p>
        <h1>{prompt.text}</h1>
        <p className="muted small">Checked {(check.completedAt ?? check.createdAt).toLocaleString()}</p>
        <div className="row-gap">
          {check.mentioned ? <Pill tone="good">Named at #{check.position}</Pill> : <Pill tone="bad">Not named</Pill>}
          {check.cited ? <Pill tone="good">Your site cited</Pill> : <Pill tone="neutral">Not cited</Pill>}
        </div>
      </div>

      {check.brandsFound && check.brandsFound.length > 0 && (
        <section className="card">
          <h2>Brands named, in order</h2>
          <ol className="ranked">
            {check.brandsFound.map((b) => (
              <li key={b.name} className={b.isOwn ? "own" : ""}>
                {b.name}
                {b.isOwn && <span className="you">you</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card">
        <h2>The answer</h2>
        {check.status === "error" ? (
          <p className="muted">This check failed: {check.error}</p>
        ) : (
          <div className="answer">{check.answer || "No answer text returned."}</div>
        )}
      </section>

      {check.sources && check.sources.length > 0 && (
        <section className="card">
          <h2>Sources the engine used</h2>
          <ul className="list">
            {check.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer nofollow">
                  {s.title || s.url}
                </a>
                <span className="muted small"> · {s.domain}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
