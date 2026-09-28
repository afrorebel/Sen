import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="app-shell">
      <header className="app-header no-print">
        <Link href="/app" className="logo">
          AEO<span>GrowthLeads</span>
        </Link>
        <nav>
          {user.isStaff && <Link href="/admin">Admin</Link>}
          <span className="muted small who">{user.email}</span>
          <form action={logout}>
            <button className="btn ghost small">Log out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
