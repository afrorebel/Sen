import type { Brand, BrandHit, Source } from "../db/schema";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function domainRoot(domain: string) {
  return domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/.]/)[0];
}

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

interface Entity {
  name: string;
  isOwn: boolean;
  patterns: RegExp[];
  domain?: string;
}

function entity(name: string, isOwn: boolean, extraNames: string[], domain?: string): Entity {
  const terms = new Set([name, ...extraNames].map((t) => t.trim()).filter((t) => t.length >= 3));
  if (domain) {
    terms.add(normalizeDomain(domain));
    const root = domainRoot(domain);
    // A bare domain root like "acme" is only safe to match when it's distinctive.
    if (root.length >= 5) terms.add(root);
  }
  return {
    name,
    isOwn,
    domain: domain ? normalizeDomain(domain) : undefined,
    patterns: [...terms].map((t) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(t)}(?=$|[^\\p{L}\\p{N}])`, "iu")),
  };
}

export interface Analysis {
  mentioned: boolean;
  position: number | null;
  cited: boolean;
  brandsFound: BrandHit[];
}

/**
 * Works out whether the brand was named, where it ranked among the brands named,
 * and whether one of its pages was used as a source.
 */
export function analyzeAnswer(
  brand: Pick<Brand, "name" | "domain" | "aliases" | "competitors">,
  answer: { text: string; sources: Source[]; brandEntities: string[] },
): Analysis {
  const own = entity(brand.name, true, brand.aliases, brand.domain);
  const tracked = [own, ...brand.competitors.map((c) => entity(c.name, false, [], c.domain))];
  const trackedNames = new Set(tracked.map((t) => t.name.toLowerCase()));
  const discovered = answer.brandEntities
    .filter((n) => !trackedNames.has(n.toLowerCase()) && !own.patterns.some((p) => p.test(n)))
    .map((n) => entity(n, false, []));

  const hits: { name: string; isOwn: boolean; index: number }[] = [];
  for (const e of [...tracked, ...discovered]) {
    let first = Infinity;
    for (const p of e.patterns) {
      const m = p.exec(answer.text);
      if (m) first = Math.min(first, m.index);
    }
    if (first !== Infinity) hits.push({ name: e.name, isOwn: e.isOwn, index: first });
  }
  hits.sort((a, b) => a.index - b.index);
  const brandsFound = hits.map((h, i) => ({ name: h.name, isOwn: h.isOwn, position: i + 1 }));
  const ownHit = brandsFound.find((b) => b.isOwn);

  const ownDomain = normalizeDomain(brand.domain);
  const cited = answer.sources.some((s) => {
    const d = normalizeDomain(s.domain || s.url);
    return d === ownDomain || d.endsWith(`.${ownDomain}`);
  });

  return { mentioned: Boolean(ownHit), position: ownHit?.position ?? null, cited, brandsFound };
}
