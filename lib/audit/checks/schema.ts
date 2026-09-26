import { check, typesOf, type AuditContext } from "../context";
import type { CheckResult } from "../types";

const ORG_TYPES = [
  "Organization",
  "Corporation",
  "LocalBusiness",
  "ProfessionalService",
  "Store",
  "Restaurant",
  "MedicalBusiness",
  "LegalService",
  "EducationalOrganization",
  "NGO",
  "OnlineBusiness",
  "Person",
];
const CONTENT_TYPES = ["Article", "BlogPosting", "NewsArticle", "Product", "Service", "SoftwareApplication", "Course", "Event", "Recipe", "HowTo", "VideoObject", "Offer"];

function findByType(ctx: AuditContext, types: string[], matchAnyBusiness = false) {
  return ctx.jsonLd.filter((n) =>
    typesOf(n).some((t) => types.includes(t) || (matchAnyBusiness && t.endsWith("Business"))),
  );
}

export function schemaChecks(ctx: AuditContext): CheckResult[] {
  const results: CheckResult[] = [];
  const $ = ctx.$;
  const blocks = $('script[type="application/ld+json"]');
  let invalid = 0;
  blocks.each((_, el) => {
    try {
      JSON.parse($(el).text());
    } catch {
      invalid++;
    }
  });
  const hasMicrodata = $("[itemscope][itemtype]").length > 0;

  results.push(
    check({
      id: "structured-data-present",
      category: "schema",
      title: "Structured data (JSON-LD) is present",
      status: ctx.jsonLd.length > 0 ? (invalid ? "warn" : "pass") : hasMicrodata ? "warn" : "fail",
      detail:
        ctx.jsonLd.length > 0
          ? `Found ${blocks.length} JSON-LD block(s) describing: ${ctx.schemaTypes.join(", ")}.${invalid ? ` ${invalid} block(s) contain invalid JSON.` : ""}`
          : hasMicrodata
            ? "Only microdata found. JSON-LD is easier for AI parsers and is Google's recommended format."
            : "No schema.org structured data found on the page.",
      recommendation: invalid
        ? "Fix the JSON syntax errors in your JSON-LD blocks — invalid blocks are ignored entirely."
        : "Add schema.org JSON-LD. Structured data gives answer engines unambiguous facts (who you are, what you sell, prices, FAQs) they can quote with confidence.",
      impact: "high",
      effort: "medium",
      weight: 3,
    }),
  );

  const org = findByType(ctx, ORG_TYPES, true);
  results.push(
    check({
      id: "organization-schema",
      category: "schema",
      title: "Organization / LocalBusiness entity markup",
      status: org.length ? "pass" : "fail",
      detail: org.length
        ? `Entity declared as ${typesOf(org[0]).join("/")}${org[0].name ? ` "${String(org[0].name)}"` : ""}.`
        : "No Organization, LocalBusiness or Person entity is declared.",
      recommendation:
        "Add Organization (or LocalBusiness) JSON-LD with name, url, logo, description, contactPoint, address and sameAs links. This is how AI engines resolve your brand as an entity.",
      impact: "high",
      effort: "low",
      weight: 3,
    }),
  );

  const sameAs = org.flatMap((o) => (Array.isArray(o.sameAs) ? o.sameAs : o.sameAs ? [o.sameAs] : [])) as string[];
  results.push(
    check({
      id: "sameas-links",
      category: "schema",
      title: "Entity linked to external profiles (sameAs)",
      status: sameAs.length >= 3 ? "pass" : sameAs.length > 0 ? "warn" : "fail",
      score: Math.min(sameAs.length / 3, 1),
      detail: sameAs.length
        ? `${sameAs.length} sameAs profile link(s): ${sameAs.slice(0, 5).join(", ")}${sameAs.length > 5 ? "…" : ""}`
        : "No sameAs links connecting your entity to Wikipedia, Wikidata, LinkedIn, Crunchbase or social profiles.",
      recommendation:
        "Add sameAs URLs (LinkedIn, Crunchbase, Wikipedia/Wikidata, G2, Google Business Profile, social accounts). These corroborate your identity across the knowledge graph LLMs rely on.",
      impact: "medium",
      effort: "low",
      weight: 2,
    }),
  );

  const website = findByType(ctx, ["WebSite"]);
  results.push(
    check({
      id: "website-schema",
      category: "schema",
      title: "WebSite schema",
      status: website.length ? "pass" : "warn",
      detail: website.length ? "WebSite entity declared." : "No WebSite entity declared.",
      recommendation: "Add a WebSite JSON-LD node with name, url and publisher pointing at your Organization.",
      impact: "low",
      weight: 1,
    }),
  );

  const faq = findByType(ctx, ["FAQPage", "QAPage"]);
  results.push(
    check({
      id: "faq-schema",
      category: "schema",
      title: "FAQ / Q&A markup",
      status: faq.length ? "pass" : "warn",
      detail: faq.length
        ? `FAQPage markup with ${(faq[0].mainEntity as unknown[] | undefined)?.length ?? 0} question(s).`
        : "No FAQPage or QAPage markup.",
      recommendation:
        "Add a visible FAQ section answering real customer questions and mark it up with FAQPage JSON-LD. Question→answer pairs map directly onto how people prompt AI assistants.",
      impact: "medium",
      effort: "medium",
      weight: 2,
    }),
  );

  const content = findByType(ctx, CONTENT_TYPES);
  results.push(
    check({
      id: "content-schema",
      category: "schema",
      title: "Content-type markup (Product, Service, Article…)",
      status: content.length ? "pass" : "warn",
      detail: content.length
        ? `Declared: ${[...new Set(content.flatMap(typesOf))].join(", ")}.`
        : "No Product, Service, Article or similar content markup.",
      recommendation:
        "Describe what the page offers with the matching type — Service/Product (with offers, price, aggregateRating) or Article/BlogPosting (with author, datePublished, dateModified).",
      impact: "medium",
      effort: "medium",
      weight: 2,
    }),
  );

  const breadcrumb = findByType(ctx, ["BreadcrumbList"]);
  results.push(
    check({
      id: "breadcrumb-schema",
      category: "schema",
      title: "BreadcrumbList markup",
      status: breadcrumb.length ? "pass" : "warn",
      detail: breadcrumb.length ? "BreadcrumbList declared." : "No BreadcrumbList markup.",
      recommendation: "Add BreadcrumbList JSON-LD so engines understand where the page sits in your site hierarchy.",
      impact: "low",
      weight: 0.5,
    }),
  );

  const rating = ctx.jsonLd.some((n) => n.aggregateRating || typesOf(n).includes("Review"));
  results.push(
    check({
      id: "review-schema",
      category: "schema",
      title: "Reviews / ratings markup",
      status: rating ? "pass" : "warn",
      detail: rating ? "Review or AggregateRating data present." : "No Review or AggregateRating markup.",
      recommendation: "Mark up genuine customer reviews (AggregateRating/Review). Social proof is a strong signal when AI engines recommend vendors.",
      impact: "medium",
      effort: "medium",
      weight: 1,
    }),
  );

  return results;
}
