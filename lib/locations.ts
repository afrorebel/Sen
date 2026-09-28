/** DataForSEO / Google geo-target codes for the markets we support out of the box. */
export const COUNTRIES = [
  { iso: "US", name: "United States", code: 2840 },
  { iso: "GB", name: "United Kingdom", code: 2826 },
  { iso: "CA", name: "Canada", code: 2124 },
  { iso: "AU", name: "Australia", code: 2036 },
  { iso: "NZ", name: "New Zealand", code: 2554 },
  { iso: "IE", name: "Ireland", code: 2372 },
  { iso: "NG", name: "Nigeria", code: 2566 },
  { iso: "ZA", name: "South Africa", code: 2710 },
  { iso: "GH", name: "Ghana", code: 2288 },
  { iso: "KE", name: "Kenya", code: 2404 },
  { iso: "IN", name: "India", code: 2356 },
  { iso: "AE", name: "United Arab Emirates", code: 2784 },
  { iso: "DE", name: "Germany", code: 2276 },
  { iso: "FR", name: "France", code: 2250 },
] as const;

export function countryByIso(iso: string) {
  return COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];
}

/** Starter prompts from the playbook's four buckets: best/top, problem, comparison, local. */
export function suggestPrompts(input: { category: string; city?: string | null; competitors: string[] }): {
  text: string;
  intent: string;
}[] {
  const cat = input.category.trim().toLowerCase();
  if (!cat) return [];
  const out: { text: string; intent: string }[] = [
    { text: `What is the best ${cat} company?`, intent: "best" },
    { text: `Top rated ${cat} services`, intent: "best" },
    { text: `Who should I hire for ${cat}?`, intent: "best" },
    { text: `How much does ${cat} cost?`, intent: "problem" },
    { text: `How do I choose a good ${cat} provider?`, intent: "problem" },
    { text: `What questions should I ask before hiring a ${cat} company?`, intent: "problem" },
  ];
  if (input.city) {
    out.push(
      { text: `Best ${cat} in ${input.city}`, intent: "local" },
      { text: `Recommended ${cat} near ${input.city}`, intent: "local" },
    );
  }
  for (const c of input.competitors.slice(0, 3)) {
    out.push({ text: `${c} alternatives for ${cat}`, intent: "comparison" });
  }
  return out;
}

/** Guesses which playbook bucket a prompt belongs to, so imported lists get sensible labels. */
export function inferIntent(text: string, city?: string | null): string {
  const t = text.toLowerCase();
  if (/\b(alternative|alternatives|vs\.?|versus|compared to|instead of)\b/.test(t)) return "comparison";
  if (/\bnear me\b|\bnear\b|\bin [A-Z]/.test(text) || (city && t.includes(city.toLowerCase()))) return "local";
  if (/\b(best|top|recommended|who should i hire|leading)\b/.test(t)) return "best";
  if (/^(how|what|why|when|should|can|is|do|does)\b/.test(t)) return "problem";
  return "other";
}
