import Link from "next/link";
import { requireOrg, requireUser } from "@/lib/auth";
import { planFor } from "@/lib/plans";

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const { org, role } = await requireOrg(user, orgId);
  const base = `/app/o/${orgId}`;
  return (
    <div className="org-layout">
      <aside className="org-nav no-print">
        <div className="org-name">
          <b>{org.name}</b>
          <span className="muted small">
            {planFor(org.plan).name}
            {org.doneForYou && org.plan !== "dfy" ? " · Done for you" : ""}
          </span>
        </div>
        <nav>
          <Link href={base}>Brands</Link>
          {(org.doneForYou || role !== "client") && <Link href={`${base}/work`}>{org.doneForYou ? "Done-for-you work" : "Tasks"}</Link>}
          {role === "owner" && <Link href={`${base}/team`}>Team & clients</Link>}
          {role !== "client" && <Link href="/pricing">Plans</Link>}
        </nav>
      </aside>
      <main className="org-main">{children}</main>
    </div>
  );
}
