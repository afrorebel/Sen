import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrgs, requireUser } from "@/lib/auth";
import { planFor } from "@/lib/plans";

export const metadata = { title: "Workspaces · AEOGrowthLeads" };

export default async function AppHome() {
  const user = await requireUser();
  const orgs = await getOrgs(user.id);
  if (orgs.length === 1 && !user.isStaff) redirect(`/app/o/${orgs[0].org.id}`);
  return (
    <main className="wrap page">
      <h1>Your workspaces</h1>
      {orgs.length === 0 ? (
        <p className="muted">You don&apos;t belong to any workspace yet. Ask your account owner to add you.</p>
      ) : (
        <div className="grid-cards">
          {orgs.map(({ org, role }) => (
            <Link key={org.id} href={`/app/o/${org.id}`} className="card link-card">
              <h3>{org.name}</h3>
              <p className="muted small">
                {planFor(org.plan).name} plan · {role}
                {org.doneForYou && " · Done for you"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
