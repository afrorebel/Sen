import { check, typesOf, type AuditContext } from "../context";
import type { CheckResult } from "../types";

const SOCIAL = /(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com|github\.com|crunchbase\.com|wikipedia\.org|g2\.com|trustpilot\.com|yelp\.com)/i;

export function trustChecks(ctx: AuditContext): CheckResult[] {
  const $ = ctx.$;
  const results: CheckResult[] = [];
  const links = $("a[href]")
    .toArray()
    .map((el) => ({ href: $(el).attr("href") ?? "", text: $(el).text().trim().toLowerCase() }));
  const hasLink = (re: RegExp) => links.some((l) => re.test(l.href) || re.test(l.text));

  const about = hasLink(/about|our[- ]story|who[- ]we[- ]are|company|team/i);
  results.push(
    check({
      id: "about-page",
      category: "trust",
      title: "About / company page is linked",
      status: about ? "pass" : "fail",
      detail: about ? "An About/Team page is linked from this page." : "No link to an About, Team or Company page.",
      recommendation: "Link a detailed About page (founders, history, credentials, mission). AI engines use it to judge who is behind the content.",
      impact: "medium",
      weight: 1.5,
    }),
  );

  const email = links.some((l) => l.href.startsWith("mailto:")) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(ctx.text);
  const phone = links.some((l) => l.href.startsWith("tel:")) || /(\+?\d[\d\s().-]{8,}\d)/.test(ctx.text);
  const address = ctx.jsonLd.some((n) => n.address) || $("address").length > 0;
  const contactSignals = [email, phone, address].filter(Boolean).length;
  const contactLink = hasLink(/contact/i);
  results.push(
    check({
      id: "contact-info",
      category: "trust",
      title: "Real-world contact details (NAP)",
      status: contactSignals >= 2 ? "pass" : contactSignals === 1 || contactLink ? "warn" : "fail",
      score: Math.max(contactSignals / 3, contactLink ? 0.4 : 0),
      detail: `Email: ${email ? "yes" : "no"} · Phone: ${phone ? "yes" : "no"} · Address: ${address ? "yes" : "no"} · Contact page link: ${contactLink ? "yes" : "no"}.`,
      recommendation:
        "Show consistent Name, Address and Phone (NAP) plus email in the footer and in your Organization schema. Consistency across the web builds entity confidence.",
      impact: "medium",
      weight: 1.5,
    }),
  );

  const authorSchema = ctx.jsonLd.some((n) => n.author || typesOf(n).includes("Person"));
  const byline = $('[rel="author"], .author, .byline, [itemprop="author"], meta[name="author"]').length > 0;
  results.push(
    check({
      id: "authorship",
      category: "trust",
      title: "Named authors / experts",
      status: authorSchema || byline ? "pass" : "warn",
      detail: authorSchema || byline ? "Authorship is declared on the page." : "No author byline or Person markup found.",
      recommendation:
        "Attribute content to named people with credentials and link to author bio pages (with Person schema). Demonstrated expertise is a core E-E-A-T signal.",
      impact: "medium",
      effort: "medium",
      weight: 1.5,
    }),
  );

  const year = new Date().getFullYear();
  const modified = ctx.jsonLd
    .map((n) => (n.dateModified ?? n.datePublished) as string | undefined)
    .concat($('meta[property="article:modified_time"]').attr("content"), $("time[datetime]").first().attr("datetime"))
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const lastModifiedHeader = ctx.page.headers["last-modified"] ? new Date(ctx.page.headers["last-modified"]) : undefined;
  const newest = modified ?? lastModifiedHeader;
  const ageDays = newest ? (Date.now() - newest.getTime()) / 86_400_000 : Infinity;
  const copyrightCurrent = new RegExp(`(©|&copy;|copyright)[^.]{0,40}${year}`, "i").test(ctx.text);
  results.push(
    check({
      id: "freshness",
      category: "trust",
      title: "Content freshness signals",
      status: ageDays <= 365 ? "pass" : copyrightCurrent || ageDays <= 730 ? "warn" : "fail",
      detail: newest
        ? `Most recent date signal: ${newest.toISOString().slice(0, 10)} (${Math.round(ageDays)} days ago).`
        : copyrightCurrent
          ? `No publish/modified dates, but the copyright notice shows ${year}.`
          : "No published/modified dates and no current copyright year.",
      recommendation:
        "Show a visible \"Last updated\" date and set dateModified in schema. AI search strongly prefers recent sources, especially for pricing and comparisons.",
      impact: "medium",
      weight: 1.5,
    }),
  );

  const socials = [
    ...new Set(
      links
        .filter((l) => SOCIAL.test(l.href))
        .map((l) => {
          try {
            return new URL(l.href, ctx.origin).hostname.replace(/^www\./, "");
          } catch {
            return null;
          }
        })
        .filter((h): h is string => !!h),
    ),
  ];
  results.push(
    check({
      id: "social-profiles",
      category: "trust",
      title: "Links to social & third-party profiles",
      status: socials.length >= 3 ? "pass" : socials.length > 0 ? "warn" : "fail",
      score: Math.min(socials.length / 3, 1),
      detail: socials.length ? `Linked profiles: ${socials.join(", ")}.` : "No links to social or review profiles.",
      recommendation:
        "Link your LinkedIn, review sites (G2, Trustpilot, Google) and social profiles. LLMs weigh what third parties say about you as much as what you say.",
      impact: "medium",
      weight: 1,
    }),
  );

  const proof = /(testimonial|case stud|review|rated|trusted by|clients include|customers|success stor)/i.test(ctx.text);
  results.push(
    check({
      id: "social-proof",
      category: "trust",
      title: "Testimonials, reviews or case studies",
      status: proof ? "pass" : "warn",
      detail: proof ? "Social proof content (testimonials/reviews/case studies) detected." : "No testimonials, reviews or case studies detected.",
      recommendation: "Add named testimonials, logos and case studies with measurable outcomes. These give AI engines evidence to recommend you.",
      impact: "medium",
      effort: "medium",
      weight: 1,
    }),
  );

  const policy = hasLink(/privacy|terms/i);
  results.push(
    check({
      id: "policies",
      category: "trust",
      title: "Privacy policy & terms linked",
      status: policy ? "pass" : "warn",
      detail: policy ? "Privacy/terms pages are linked." : "No privacy policy or terms link found.",
      recommendation: "Link a privacy policy and terms of service — basic legitimacy signals for any trust assessment.",
      impact: "low",
      weight: 0.5,
    }),
  );

  return results;
}
