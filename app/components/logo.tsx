import Link from "next/link";

/** The AEO GrowthLead mark and wordmark, as on aeogrowthlead.com. */
export function Logo({ href = "/", subtitle, compact = false }: { href?: string; subtitle?: string; compact?: boolean }) {
  return (
    <Link href={href} className="logo-lockup" aria-label="AEO GrowthLead home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.svg" alt="" width={34} height={34} />
      {!compact && (
        <span>
          <b>AEO GrowthLead</b>
          {subtitle && <small>{subtitle}</small>}
        </span>
      )}
    </Link>
  );
}

const ENGINE_ICON: Record<string, string> = {
  chatgpt: "/engines/chatgpt.png",
  gemini: "/engines/gemini.png",
  perplexity: "/engines/perplexity.png",
  claude: "/engines/claude.png",
  copilot: "/engines/copilot.png",
  google_ai_mode: "/engines/google.svg",
};

export function EngineIcon({ engine, size = 22, title }: { engine: string; size?: number; title?: string }) {
  const src = ENGINE_ICON[engine];
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="engine-icon" src={src} alt={title ?? engine} title={title} width={size} height={size} />;
}

/** Site favicon for source chips, served through /api/favicon (cached server-side). */
export function Favicon({ domain, size = 16 }: { domain: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="favicon"
      src={`/api/favicon?domain=${encodeURIComponent(domain)}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
    />
  );
}
