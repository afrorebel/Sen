import { SiteFooter, SiteHeader } from "../components/site-header";
import { FreeAudit } from "../free-audit";

export const metadata = {
  title: "Free AEO & GEO audit · AEO GrowthLead",
  description: "Check if ChatGPT, Claude, Perplexity and Google AI can crawl, understand and cite your website. Free, instant, no sign-up.",
};

export default function AuditPage() {
  return (
    <>
      <SiteHeader announce={false} />
      <FreeAudit />
      <SiteFooter />
    </>
  );
}
