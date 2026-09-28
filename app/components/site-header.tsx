import Link from "next/link";
import { getUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getUser();
  return (
    <header className="site-header no-print">
      <div className="wrap row">
        <Link href="/" className="logo">
          AEO<span>GrowthLeads</span>
        </Link>
        <nav>
          <Link href="/#audit">Free audit</Link>
          <Link href="/pricing">Pricing</Link>
          {user ? (
            <Link href="/app" className="btn small">Dashboard</Link>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="btn small">Start free</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
