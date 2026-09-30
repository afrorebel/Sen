import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runNow } from "@/app/actions/brands";
import { SubmitButton } from "@/app/components/forms";
import { Gate, LockIcon } from "@/app/components/gate";
import { Empty } from "@/app/components/ui";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands, runs } from "@/lib/db/schema";
import { manualRunAllowance } from "@/lib/limits";
import { hasFeature, planFor, type Feature } from "@/lib/plans";
import { mockMode } from "@/lib/tracking/dataforseo";
import { buildBrandReport } from "@/lib/tracking/report";
import { CrawlerChecklist, FullReport, KpiRow, Panels, Recommendations, ReportHeader } from "./dashboard";
import { Audit, Competitors, Prompts, Reports, Settings, Sources } from "./sections";
import { Tasks } from "./tasks";
import { Traffic } from "./traffic";

const TITLES: Record<string, string> = {
  overview: "Dashboard",
  prompts: "Prompts",
  sources: "Sources",
  competitors: "Competitors",
  traffic: "AI Traffic",
  tasks: "Tasks",
  audit: "Site audit",
  reports: "Reports",
  settings: "Brand settings",
};

export async function generateMetadata() {
  return { title: "Dashboard · AEO GrowthLead" };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; brandId: string }>;
  searchParams: Promise<{ tab?: string; status?: string; q?: string; cat?: string; sort?: string; range?: string }>;
}) {
  const { orgId, brandId } = await params;
  const sp = await searchParams;
  const rawTab = sp.tab ?? "overview";
  const user = await requireUser();
  const { org, canEdit, role } = await requireOrg(user, orgId);
  const [owned] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.orgId, orgId)))
    .limit(1);
  if (!owned) notFound();
  const tab = rawTab in TITLES && (rawTab !== "settings" || canEdit) ? rawTab : "overview";

  const report = (await buildBrandReport(brandId))!;
  const { brand } = report;
  const [running] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.brandId, brandId), eq(runs.status, "running")))
    .limit(1);
  const base = `/app/o/${orgId}/b/${brandId}`;
  const period = new Date().toISOString().slice(0, 7);
  const plan = planFor(org.plan);
  const has = (f: Feature) => hasFeature(org.plan, f);
  const runsLeft = await manualRunAllowance(orgId, org.plan);
  const billing = `/app/o/${orgId}/billing`;
  const gate = { billingHref: billing, canUpgrade: role === "owner" };

  return (
    <div className="stack-lg">
      <div className="topbar">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href={`/app/o/${orgId}`}>Brands</Link>
          <span aria-hidden>›</span>
          <Link href={base}>{brand.name}</Link>
          <span aria-hidden>›</span>
          <b>{TITLES[tab]}</b>
        </nav>
        <div className="topbar-actions">
          {has("reports") ? (
            <a className="btn ghost small" href={`/api/reports/${brandId}?period=${period}`}>
              ⤓ Download PDF
            </a>
          ) : (
            <Link className="btn ghost small locked" href={billing} title="PDF reports are included in Pro and Agency">
              <LockIcon size={12} /> PDF report
            </Link>
          )}
          {canEdit &&
            (plan.manualRuns === 0 ? (
              <Link className="btn small locked" href={billing} title="On-demand re-checks are included in Pro and Agency">
                <LockIcon size={12} /> Run check now
              </Link>
            ) : (
              <form action={runNow.bind(null, brandId)}>
                <SubmitButton className="btn small" pendingText="Starting…" disabled={!running && runsLeft.left === 0}>
                  {running ? "Checking…" : runsLeft.left === 0 ? "No re-checks left" : `Run check now · ${runsLeft.left} left`}
                </SubmitButton>
              </form>
            ))}
        </div>
      </div>

      {mockMode() && user.isStaff && (
        <div className="notice">
          Demo data: DataForSEO isn&apos;t connected, so AI answers are simulated. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to go live.
        </div>
      )}
      {running && (
        <div className="notice">
          Checking {running.checksTotal} prompt × engine combinations: {running.checksDone} done. Refresh to see progress.
        </div>
      )}

      {tab === "overview" &&
        (report.vis.latest || report.audit ? (
          <>
            <ReportHeader report={report} />
            <KpiRow report={report} />
            <Panels report={report} base={base} />
            <Recommendations report={report} canEdit={canEdit} limit={has("tasks") ? undefined : 3} upgrade={has("tasks") ? undefined : gate} />
            <FullReport report={report} base={base} />
            <CrawlerChecklist report={report} base={base} />
          </>
        ) : (
          <>
            <ReportHeader report={report} />
            <Empty title="Your first check is on its way">
              <p className="muted">AI engines are being asked your prompts now. Results usually arrive within a few minutes.</p>
              <Link className="btn ghost" href={`${base}?tab=prompts`}>
                Review prompts
              </Link>
            </Empty>
          </>
        ))}
      {tab === "prompts" && <Prompts vis={report.vis} base={base} brandId={brandId} canEdit={canEdit} engines={brand.engines} />}
      {tab === "sources" && (
        <Gate locked={!has("sources")} feature="sources" title="See which sites AI engines trust" body="Find the Reddit threads, listicles, directories and publishers the engines cite for your prompts, and where your own site shows up." {...gate}>
          <Sources report={report} />
        </Gate>
      )}
      {tab === "competitors" && (
        <Gate locked={!has("competitors")} feature="competitors" title="Track who AI recommends instead of you" body="Share of voice, key competitors, the prompts each rival wins, and new brands the engines start recommending." {...gate}>
          <Competitors report={report} canEdit={canEdit && has("competitors")} />
        </Gate>
      )}
      {tab === "tasks" && <Tasks report={report} base={base} filters={sp} canEdit={canEdit} limited={has("tasks") ? undefined : gate} />}
      {tab === "traffic" && (
        <Gate locked={!has("traffic")} feature="traffic" title="See AI crawlers and AI visitors on your site" body="Which AI bots read your pages, which hit errors, and how many visitors ChatGPT, Perplexity, Gemini and Claude send you." {...gate}>
          <Traffic brand={brand} base={base} range={sp.range} canEdit={canEdit && has("traffic")} />
        </Gate>
      )}
      {tab === "audit" && <Audit brandId={brandId} canEdit={canEdit} />}
      {tab === "reports" && (
        <Gate locked={!has("reports")} feature="reports" title="Send a client-ready PDF every month" body="Download any month's report, email it on demand, or have it sent automatically on the 1st." {...gate}>
          <Reports brand={brand} base={base} canEdit={canEdit && has("reports")} />
        </Gate>
      )}
      {tab === "settings" && canEdit && <Settings brand={brand} planId={org.plan} />}
    </div>
  );
}
