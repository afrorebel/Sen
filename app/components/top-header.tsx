import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getUser } from "@/lib/auth";
import { Logo } from "./logo";

/** Header for account-level pages outside a workspace (workspace list, account, admin). */
export async function TopHeader() {
  const user = await getUser();
  return (
    <header className="app-header no-print">
      <Logo href="/app" subtitle="AI Visibility Platform" />
      <nav>
        <Link href="/app">Workspaces</Link>
        {user?.isStaff && <Link href="/admin">Admin</Link>}
        {user && (
          <Link href="/app/account" className="muted small who">
            {user.email}
          </Link>
        )}
        <form action={logout}>
          <button className="btn ghost small">Log out</button>
        </form>
      </nav>
    </header>
  );
}
