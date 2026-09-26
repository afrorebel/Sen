# Sen — AEO & GEO Audit Tool

Sen audits a website for **Answer Engine Optimization (AEO)** and **Generative Engine Optimization (GEO)**. It shows how ready the site is to be crawled, understood, trusted and cited by ChatGPT, Claude, Perplexity, Gemini, Copilot and Google AI Overviews. You get a 0–100 score, a breakdown by category and a prioritised action plan.

## What it checks

| Category | Weight | Signals |
|---|---|---|
| **AI Crawler Access** | 25 | robots.txt rules for 16 AI bots (OAI-SearchBot, ChatGPT-User, GPTBot, Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Google-Extended, Bingbot, Applebot-Extended…), live CDN/WAF blocking probes as GPTBot/ClaudeBot/PerplexityBot, `noindex`/`nosnippet`/`noai` directives, XML sitemap + `<lastmod>`, `llms.txt` |
| **Answer-Ready Content** | 25 | content present without JavaScript, depth, single H1, heading hierarchy, question-style headings, answer-first summary, paragraph length, lists/tables, statistics, citations & quotes, readability, image alt text |
| **Structured Data & Entity** | 20 | valid JSON-LD, Organization/LocalBusiness, `sameAs` profile links, WebSite, FAQPage, Product/Service/Article, BreadcrumbList, reviews/ratings |
| **Authority & Trust (E-E-A-T)** | 15 | About page, NAP contact details, authorship, freshness dates, social/review profiles, testimonials/case studies, privacy/terms |
| **Technical Foundations** | 15 | HTTPS, title, meta description, canonical, `lang`, Open Graph, viewport, response time, HTML weight |
| **AI Visibility (GEO)** *(optional)* | 25 | Claude with live web search answers buyer-intent questions generated from your site. The tool measures brand **mention rate**, **citation rate**, **share of voice** and which competitors get recommended instead. |

Score bands match common industry tools: **0–40 Low**, **41–70 Moderate**, **71–100 High** readiness.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY to enable the AI visibility test
npm run dev                  # http://localhost:3000
```

### CLI

```bash
npm run audit -- example.com
npm run audit -- example.com --brand "Acme" --no-visibility
npm run audit -- example.com --json > report.json
```

### API

```bash
curl -X POST http://localhost:3000/api/audit \
  -H 'content-type: application/json' \
  -d '{"url":"example.com","brand":"Acme","visibility":true}'
```

This returns an `AuditReport` JSON object (see `lib/audit/types.ts`).

## AI visibility test

When `ANTHROPIC_API_KEY` is set, the audit also:

1. Asks Claude to write 5 realistic questions a prospective customer would ask, based on the homepage. The brand name is never included.
2. Answers each question with Claude and the `web_search` server tool, the same way an AI assistant would.
3. Extracts every brand recommended in each answer. It records whether you were mentioned, your rank, whether your domain was retrieved or cited, and which competitors appeared.

The model defaults to `claude-opus-5`; override it with `AEO_VISIBILITY_MODEL`. Server-side refusal fallbacks are enabled. A full probe makes about 7 API calls plus up to 15 web searches, so expect it to add 30–90 seconds.

## Project layout

```
app/
  page.tsx            landing page + audit form
  report.tsx          report UI (score, categories, quick wins, visibility, crawlers, action plan, checks)
  api/audit/route.ts  POST /api/audit
lib/audit/
  index.ts            orchestrator, category weights, scoring, action-plan ranking
  context.ts          fetches page, robots.txt, llms.txt, sitemap, bot probes; parses HTML/JSON-LD
  fetcher.ts          fetch with timeouts, size cap, manual redirects and SSRF protection
  robots.ts           RFC 9309 robots.txt parser
  visibility.ts       Claude + web search GEO probe
  checks/             crawler, content, schema, trust, technical checks
scripts/audit.ts      CLI
```

## Adding a check

Each check returns a `CheckResult` built with `check()` from `lib/audit/context.ts`: a status (`pass`/`warn`/`fail`/`info`), an optional partial `score`, an `impact`, an `effort` and a `weight` within its category. The scoring and action-plan ranking pick it up automatically. Priority is `impact × weight × (1 − score) ÷ effort`.

## Deploying

This is a standard Next.js app, so it deploys to Vercel or any Node host. The audit route runs on the Node.js runtime with `maxDuration = 300` to leave room for the visibility probe. The fetcher blocks private and loopback addresses on every redirect hop, so the public endpoint can't be used to reach internal services. Add rate limiting before you expose it publicly.
