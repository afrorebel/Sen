import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { Sidebar } from "@/app/components/sidebar";
import { getOrgs, requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import { planFor } from "@/lib/plans";

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const { org, role } = await requireOrg(user, orgId);
  const orgs = (await getOrgs(user.id)).map((m) => ({ id: m.org.id, name: m.org.name }));
  if (!orgs.some((o) => o.id === org.id)) orgs.unshift({ id: org.id, name: org.name });
  const brandRows = await db
    .select({ id: brands.id, name: brands.name, domain: brands.domain })
    .from(brands)
    .where(eq(brands.orgId, orgId))
    .orderBy(brands.createdAt);

  return (
    <div className="dash">
      <Suspense>
        <Sidebar
          org={{ id: org.id, name: org.name, planName: planFor(org.plan).name, doneForYou: org.doneForYou }}
          orgs={orgs}
          brands={brandRows}
          role={role}
          user={{ name: user.name, email: user.email, isStaff: user.isStaff }}
          logout={logout}
        />
      </Suspense>
      <main className="dash-main">{children}</main>
    </div>
  );
}
