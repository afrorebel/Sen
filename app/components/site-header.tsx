import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Logo } from "./logo";

export async function SiteHeader({ announce = true }: { announce?: boolean }) {
  const user = await getUser();
  return (
    <>
      {announce && (
        <div className="announce no-print">
          New: <b>monthly AI visibility reports</b>, delivered to your inbox as a branded PDF.{" "}
          <Link href="/signup">Start free →</Link>
        </div>
      )}
      <header className="site-header no-print">
        <div className="wrap row">
          <Logo href="/" subtitle="AI Visibility Platform" />
          <nav className="site-nav">
            <Link href="/#features">Features</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/audit">Free audit</Link>
          </nav>
          <div className="site-cta">
            {user ? (
              <Link href="/app" className="btn small">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="site-login">
                  Log in
                </Link>
                <Link href="/signup" className="btn small">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer no-print">
      <div className="wrap footer-grid">
        <div>
          <Logo href="/" subtitle="AI Visibility Platform" />
          <p>
            Part of <a href="https://aeogrowthlead.com/">AEO GrowthLead</a>: restoration growth systems for AI search, lead
            generation and operations.
          </p>
        </div>
        <div>
          <h4>Product</h4>
          <Link href="/#features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/audit">Free AEO audit</Link>
          <Link href="/signup">Start free</Link>
        </div>
        <div>
          <h4>Company</h4>
          <a href="https://aeogrowthlead.com/aeo.html">AI Visibility services</a>
          <a href="https://aeogrowthlead.com/">aeogrowthlead.com</a>
          <a href="mailto:hello@aeogrowthlead.com">hello@aeogrowthlead.com</a>
        </div>
      </div>
      <div className="wrap footer-base">© {new Date().getFullYear()} AEO GrowthLead. All rights reserved.</div>
    </footer>
  );
}
