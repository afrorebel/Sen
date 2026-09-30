import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runNow } from "@/app/actions/brands";
import { SubmitButton } from "@/app/components/forms";
import { Empty } from "@/app/components/ui";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands, runs } from "@/lib/db/schema";
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
  const { org, canEdit } = await requireOrg(user, orgId);
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
          <a className="btn ghost small" href={`/api/reports/${brandId}?period=${period}`}>
            ⤓ Download PDF
          </a>
          {canEdit && (
            <form action={runNow.bind(null, brandId)}>
              <SubmitButton className="btn small" pendingText="Starting…">
                {running ? "Checking…" : "Run check now"}
              </SubmitButton>
            </form>
          )}
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
            <Recommendations report={report} canEdit={canEdit} />
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
      {tab === "sources" && <Sources report={report} />}
      {tab === "competitors" && <Competitors report={report} canEdit={canEdit} />}
      {tab === "tasks" && <Tasks report={report} base={base} filters={sp} canEdit={canEdit} />}
      {tab === "traffic" && <Traffic brand={brand} base={base} range={sp.range} canEdit={canEdit} />}
      {tab === "audit" && <Audit brandId={brandId} canEdit={canEdit} />}
      {tab === "reports" && <Reports brand={brand} base={base} canEdit={canEdit} />}
      {tab === "settings" && canEdit && <Settings brand={brand} planId={org.plan} />}
    </div>
  );
}
