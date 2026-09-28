import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addPrompts, removePrompt, runBrandAudit, runNow, updateBrand } from "@/app/actions/brands";
import { ActionForm, SubmitButton } from "@/app/components/forms";
import { Empty, Pill, ShareBars, Stat, Tabs, TrendChart, pct } from "@/app/components/ui";
import { Report } from "@/app/report";
import type { AuditReport } from "@/lib/audit/types";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audits, brands, runs } from "@/lib/db/schema";
import { COUNTRIES } from "@/lib/locations";
import { planFor } from "@/lib/plans";
import { mockMode } from "@/lib/tracking/dataforseo";
import { ENGINES, ENGINE_IDS } from "@/lib/tracking/engines";
import { brandVisibility } from "@/lib/tracking/metrics";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "prompts", label: "Prompts" },
  { id: "sources", label: "Cited sources" },
  { id: "audit", label: "Site audit" },
  { id: "settings", label: "Settings" },
];

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; brandId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgId, brandId } = await params;
  const { tab = "overview" } = await searchParams;
  const user = await requireUser();
  const { org, canEdit } = await requireOrg(user, orgId);
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.orgId, orgId)))
    .limit(1);
  if (!brand) notFound();

  const vis = await brandVisibility(brandId);
  const [running] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.brandId, brandId), eq(runs.status, "running")))
    .limit(1);
  const base = `/app/o/${orgId}/b/${brandId}`;
  const tabs = canEdit ? TABS : TABS.filter((t) => t.id !== "settings");

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <p className="muted small">
            <Link href={`/app/o/${orgId}`}>Brands</Link> /
          </p>
          <h1>{brand.name}</h1>
          <p className="muted">
            {brand.domain} · {brand.engines.map((e) => ENGINES[e as keyof typeof ENGINES]?.label ?? e).join(", ")} ·{" "}
            {brand.frequency}
            {brand.nextRunAt && !running && ` · next check ${brand.nextRunAt.toLocaleDateString()}`}
          </p>
        </div>
        {canEdit && (
          <form action={runNow.bind(null, brandId)}>
            <SubmitButton className="btn ghost" pendingText="Starting…">
              {running ? "Checking…" : "Run check now"}
            </SubmitButton>
          </form>
        )}
      </div>

      {mockMode() && user.isStaff && (
        <div className="notice">
          Demo data: DataForSEO credentials aren&apos;t configured, so answers are simulated. Add DATAFORSEO_LOGIN and
          DATAFORSEO_PASSWORD to go live.
        </div>
      )}
      {running && (
        <div className="notice">
          Checking {running.checksTotal} prompt × engine combinations: {running.checksDone} done. Refresh to see progress.
        </div>
      )}

      <Tabs base={base} current={tab} tabs={tabs} />

      {tab === "overview" && <Overview vis={vis} />}
      {tab === "prompts" && <Prompts vis={vis} base={base} brandId={brandId} canEdit={canEdit} engines={brand.engines} />}
      {tab === "sources" && <Sources vis={vis} domain={brand.domain} />}
      {tab === "audit" && <Audit brandId={brandId} canEdit={canEdit} />}
      {tab === "settings" && canEdit && <Settings brand={brand} planId={org.plan} />}
    </div>
  );
}

type Vis = Awaited<ReturnType<typeof brandVisibility>>;

function Overview({ vis }: { vis: Vis }) {
  if (!vis.latest) {
    return (
      <Empty title="No results yet">
        <p className="muted">Your first check is queued. Results usually arrive within a few minutes.</p>
      </Empty>
    );
  }
  const { latest, previous } = vis;
  const d = (a: number, b?: number) => (previous && b != null ? a - b : null);
  return (
    <>
      <section className="stats">
        <Stat label="Mention rate" value={pct(latest.mentionRate)} delta={d(latest.mentionRate, previous?.mentionRate)} hint="Answers that name you" />
        <Stat label="Citation rate" value={pct(latest.citationRate)} delta={d(latest.citationRate, previous?.citationRate)} hint="Answers that cite your site" />
        <Stat label="Share of voice" value={pct(latest.shareOfVoice)} delta={d(latest.shareOfVoice, previous?.shareOfVoice)} hint="Your share of all brand mentions" />
        <Stat
          label="Average rank"
          value={latest.avgPosition ? `#${latest.avgPosition.toFixed(1)}` : "—"}
          hint="Where you appear when named"
        />
      </section>

      {vis.trend.filter((t) => t.checks > 0).length > 1 && (
        <section className="card">
          <h2>Mention rate over time</h2>
          <TrendChart
            points={vis.trend
              .filter((t) => t.checks > 0)
              .map((t) => ({ label: t.run.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: t.mentionRate }))}
          />
        </section>
      )}

      <section className="two-col">
        <div className="card">
          <h2>By AI engine</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Mentioned</th>
                  <th>Cited</th>
                  <th>Avg rank</th>
                </tr>
              </thead>
              <tbody>
                {vis.engines.map((e) => (
                  <tr key={e.engine}>
                    <td>{e.label}</td>
                    <td className="num">{pct(e.mentionRate)}</td>
                    <td className="num">{pct(e.citationRate)}</td>
                    <td className="num">{e.avgPosition ? `#${e.avgPosition.toFixed(1)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Share of voice</h2>
          <p className="muted small">Share of all brand mentions in the latest run.</p>
          {vis.competitors.length ? <ShareBars rows={vis.competitors} /> : <p className="muted">No brands were named.</p>}
        </div>
      </section>
    </>
  );
}

function ResultCell({ r, href }: { r?: Vis["prompts"][number]["results"][keyof Vis["prompts"][number]["results"]]; href: string }) {
  if (!r) return <span className="muted">—</span>;
  if (r.status === "pending" || r.status === "processing") return <span className="muted small">checking…</span>;
  if (r.status === "error") return <Pill tone="warn">error</Pill>;
  return (
    <Link href={href} className="cell-link" title="View the full answer">
      {r.mentioned ? <Pill tone="good">#{r.position}</Pill> : <Pill tone="bad">absent</Pill>}
      {r.cited && <Pill tone="neutral">cited</Pill>}
    </Link>
  );
}

function Prompts({
  vis,
  base,
  brandId,
  canEdit,
  engines,
}: {
  vis: Vis;
  base: string;
  brandId: string;
  canEdit: boolean;
  engines: string[];
}) {
  const cols = ENGINE_IDS.filter((e) => engines.includes(e));
  return (
    <>
      <section className="card">
        <h2>Tracked prompts</h2>
        <p className="muted small">Green shows your rank in the answer; select a result to read the full answer and its sources.</p>
        {vis.prompts.length === 0 ? (
          <p className="muted">No prompts yet. Add the questions your buyers ask below.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prompt</th>
                  {cols.map((e) => (
                    <th key={e}>{ENGINES[e].label}</th>
                  ))}
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {vis.prompts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.text}
                      <div className="muted small">{p.intent}</div>
                    </td>
                    {cols.map((e) => (
                      <td key={e}>
                        <ResultCell r={p.results[e]} href={p.results[e] ? `${base}/checks/${p.results[e]!.id}` : "#"} />
                      </td>
                    ))}
                    {canEdit && (
                      <td>
                        <form action={removePrompt.bind(null, p.id)}>
                          <button className="linklike muted small" title="Stop tracking this prompt">
                            Remove
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {canEdit && (
        <section className="card">
          <h2>Add prompts</h2>
          <ActionForm action={addPrompts.bind(null, brandId)} resetOnSuccess>
            <textarea name="prompts" rows={4} placeholder="One prompt per line" required />
            <div className="field-row">
              <label>
                Type
                <select name="intent" defaultValue="auto">
                  <option value="auto">Detect automatically</option>
                  <option value="best">Best / top</option>
                  <option value="problem">Problem / how-to</option>
                  <option value="comparison">Comparison / alternative</option>
                  <option value="local">Local</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <SubmitButton>Add prompts</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}

function Sources({ vis, domain }: { vis: Vis; domain: string }) {
  if (!vis.sources.length) {
    return (
      <Empty title="No sources yet">
        <p className="muted">Once engines answer your prompts, the pages they cite show up here.</p>
      </Empty>
    );
  }
  return (
    <section className="card">
      <h2>Where AI engines get their answers</h2>
      <p className="muted small">
        The domains cited most across your prompts. Getting mentioned on these pages (threads, listicles, directories) is
        the fastest way into the answers.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Answers citing it</th>
              <th>Example page</th>
            </tr>
          </thead>
          <tbody>
            {vis.sources.map((s) => (
              <tr key={s.domain}>
                <td>
                  <b>{s.domain}</b> {s.domain.endsWith(domain) && <Pill tone="good">you</Pill>}
                </td>
                <td className="num">{s.citations}</td>
                <td>
                  <a href={s.sample} target="_blank" rel="noreferrer nofollow">
                    {s.title || s.sample}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function Audit({ brandId, canEdit }: { brandId: string; canEdit: boolean }) {
  const [latest] = await db.select().from(audits).where(eq(audits.brandId, brandId)).orderBy(desc(audits.createdAt)).limit(1);
  return (
    <>
      {canEdit && (
        <form action={runBrandAudit.bind(null, brandId)} className="row-end">
          <SubmitButton className="btn ghost" pendingText="Auditing site… (up to 30s)">
            {latest ? "Re-run audit" : "Run AEO site audit"}
          </SubmitButton>
        </form>
      )}
      {latest ? (
        <Report report={latest.report as AuditReport} />
      ) : (
        <Empty title="No audit yet">
          <p className="muted">The audit checks AI crawler access, structured data, content and trust signals.</p>
        </Empty>
      )}
    </>
  );
}

function Settings({ brand, planId }: { brand: typeof brands.$inferSelect; planId: string }) {
  const plan = planFor(planId);
  return (
    <section className="card narrow">
      <h2>Brand settings</h2>
      <ActionForm action={updateBrand.bind(null, brand.id)}>
        <div className="field-row">
          <label>
            Brand name
            <input name="name" defaultValue={brand.name} required />
          </label>
          <label>
            Website
            <input name="domain" defaultValue={brand.domain} required />
          </label>
        </div>
        <label>
          What do you sell?
          <input name="category" defaultValue={brand.category} />
        </label>
        <div className="field-row">
          <label>
            Country
            <select name="country" defaultValue={brand.countryIso}>
              {COUNTRIES.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            <input name="city" defaultValue={brand.city ?? ""} />
          </label>
        </div>
        <label>
          Other names
          <input name="aliases" defaultValue={brand.aliases.join(", ")} />
        </label>
        <label>
          Competitors (Name | domain, one per line)
          <textarea
            name="competitors"
            rows={4}
            defaultValue={brand.competitors.map((c) => (c.domain ? `${c.name} | ${c.domain}` : c.name)).join("\n")}
          />
        </label>
        <fieldset>
          <legend>AI engines (up to {plan.engineSlots} on {plan.name})</legend>
          <div className="checks">
            {ENGINE_IDS.map((e) => (
              <label key={e} className="check-label">
                <input type="checkbox" name="engines" value={e} defaultChecked={brand.engines.includes(e)} />
                {ENGINES[e].label}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Frequency
          <select name="frequency" defaultValue={brand.frequency}>
            <option value="weekly">Weekly</option>
            <option value="daily" disabled={!plan.frequencies.includes("daily")}>
              Daily{plan.frequencies.includes("daily") ? "" : " (Growth and above)"}
            </option>
          </select>
        </label>
        <SubmitButton>Save settings</SubmitButton>
      </ActionForm>
    </section>
  );
}
