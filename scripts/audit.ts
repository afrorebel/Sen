/**
 * CLI: npm run audit -- https://example.com [--brand "Acme"] [--no-visibility] [--json]
 */
import { runAudit } from "../lib/audit";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const brandIdx = args.indexOf("--brand");
const brand = brandIdx >= 0 ? args[brandIdx + 1] : undefined;

if (!url) {
  console.error('Usage: npm run audit -- <url> [--brand "Name"] [--no-visibility] [--json]');
  process.exit(1);
}

const icon = { pass: "✓", warn: "!", fail: "✗", info: "i" } as const;

runAudit(url, { brand, visibility: !args.includes("--no-visibility") })
  .then((report) => {
    if (args.includes("--json")) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(`\nAEO/GEO audit — ${report.finalUrl} (${report.brand})`);
    console.log(`Overall: ${report.overall}/100 (${report.band} readiness)\n`);
    for (const cat of report.categories) {
      console.log(`${cat.label.padEnd(30)} ${String(cat.score).padStart(3)}/100  (${cat.passed}/${cat.total} passed)`);
      for (const c of report.checks.filter((c) => c.category === cat.id)) {
        console.log(`   ${icon[c.status]} ${c.title} — ${c.detail}`);
      }
    }
    console.log("\nTop actions:");
    report.actionPlan.slice(0, 8).forEach((c, i) => console.log(` ${i + 1}. [${c.impact} impact / ${c.effort} effort] ${c.recommendation}`));
    if (report.visibility?.error) console.log(`\nVisibility probe failed: ${report.visibility.error}`);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
