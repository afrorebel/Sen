"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export interface SidebarProps {
  org: { id: string; name: string; planName: string; doneForYou: boolean };
  orgs: { id: string; name: string }[];
  brands: { id: string; name: string; domain: string }[];
  role: "owner" | "member" | "client";
  user: { name: string; email: string; isStaff: boolean };
  logout: () => Promise<void>;
}

const I = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  prompts: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  sources: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  competitors: "M18 20V10M12 20V4M6 20v-6",
  audit: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  reports: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 2.6a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  brands: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1",
  tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  team: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  billing: "M1 4h22v16H1zM1 10h22",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Item({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`side-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon d={icon} />
      <span>{label}</span>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="side-section">
      <div className="side-title">{title}</div>
      {children}
    </div>
  );
}

export function Sidebar({ org, orgs, brands, role, user, logout }: SidebarProps) {
  const params = useParams<{ brandId?: string }>();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get("tab") ?? "overview";
  const base = `/app/o/${org.id}`;
  const brand = brands.find((b) => b.id === params.brandId) ?? brands[0];
  const inBrand = Boolean(params.brandId) && !pathname.includes("/checks/");
  const brandBase = brand ? `${base}/b/${brand.id}` : null;
  const isTab = (t: string) => inBrand && pathname === brandBase && tab === t;

  return (
    <aside className="sidebar no-print">
      <div className="side-top">
        <Link href="/app" className="side-logo" aria-label="All workspaces">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.svg" alt="" width={30} height={30} />
        </Link>
        <details className="switcher">
          <summary>
            <span className="switcher-name">{org.name}</span>
            <span className="switcher-sub">
              {org.planName}
              {org.doneForYou && org.planName !== "Done For You" ? " · Done for you" : ""}
            </span>
          </summary>
          <div className="switcher-menu">
            {orgs.map((o) => (
              <Link key={o.id} href={`/app/o/${o.id}`} className={o.id === org.id ? "current" : ""}>
                {o.name}
              </Link>
            ))}
            <Link href="/app" className="muted">
              All workspaces →
            </Link>
          </div>
        </details>
      </div>

      {brand && brandBase && (
        <details className="switcher brand-switcher">
          <summary>
            <span className="switcher-name">{brand.name}</span>
            <span className="switcher-sub">{brand.domain}</span>
          </summary>
          <div className="switcher-menu">
            {brands.map((b) => (
              <Link key={b.id} href={`${base}/b/${b.id}`} className={b.id === brand.id ? "current" : ""}>
                {b.name}
              </Link>
            ))}
            {role !== "client" && <Link href={`${base}/brands/new`}>+ Add brand</Link>}
          </div>
        </details>
      )}

      <nav className="side-nav">
        {brandBase && (
          <Section title="Analytics">
            <Item href={brandBase} icon={I.dashboard} label="Dashboard" active={isTab("overview")} />
            <Item href={`${brandBase}?tab=prompts`} icon={I.prompts} label="Prompts" active={isTab("prompts") || pathname.includes("/checks/")} />
            <Item href={`${brandBase}?tab=sources`} icon={I.sources} label="Sources" active={isTab("sources")} />
            <Item href={`${brandBase}?tab=competitors`} icon={I.competitors} label="Competitors" active={isTab("competitors")} />
            <Item href={`${brandBase}?tab=audit`} icon={I.audit} label="Site audit" active={isTab("audit")} />
            <Item href={`${brandBase}?tab=reports`} icon={I.reports} label="Reports" active={isTab("reports")} />
            {role !== "client" && <Item href={`${brandBase}?tab=settings`} icon={I.settings} label="Brand settings" active={isTab("settings")} />}
          </Section>
        )}
        <Section title="Workspace">
          <Item href={base} icon={I.brands} label="Brands" active={pathname === base} />
          {(org.doneForYou || role !== "client") && (
            <Item href={`${base}/work`} icon={I.tasks} label={org.doneForYou ? "Done-for-you work" : "Tasks"} active={pathname.startsWith(`${base}/work`)} />
          )}
          {role === "owner" && <Item href={`${base}/team`} icon={I.team} label="Team & clients" active={pathname.startsWith(`${base}/team`)} />}
          {role === "owner" && <Item href={`${base}/billing`} icon={I.billing} label="Billing" active={pathname.startsWith(`${base}/billing`)} />}
        </Section>
      </nav>

      <details className="side-user">
        <summary>
          <span className="avatar" aria-hidden>
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="side-user-name">{user.name}</span>
        </summary>
        <div className="switcher-menu up">
          <span className="muted small">{user.email}</span>
          <Link href="/app/account">Account</Link>
          {user.isStaff && <Link href="/admin">Admin</Link>}
          <form action={logout}>
            <button className="linklike">Log out</button>
          </form>
        </div>
      </details>
    </aside>
  );
}
