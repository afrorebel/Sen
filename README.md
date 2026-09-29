# AEO GrowthLead

AI visibility tracking, AEO/GEO site audits and done-for-you delivery, at **app.aeogrowthlead.com**.

Businesses see whether ChatGPT, Google AI Mode, Perplexity, Gemini and Claude name them when buyers ask questions, who gets recommended instead, and which sources the engines cite. Your team delivers done-for-you work from the same platform, and clients follow it in a portal.

## What's in the app

| Area | What it does |
|---|---|
| **Product site** (`/`, `/pricing`) | Marketing homepage and pricing in the aeogrowthlead.com brand, with real dashboard screenshots (`public/screens/`) and a price-comparison section (`app/components/price-compare.tsx`; keep competitor prices current). |
| **Free AEO audit** (`/audit`) | Public lead magnet. Scores any URL on AI crawler access, structured data, answer-ready content, trust and technical signals, then links to sign-up. |
| **Brands & prompts** | Each brand has a domain, category, location, competitors and the buyer prompts to track. A prompt suggester builds lists from the playbook's four buckets (best/top, problem, comparison, local). |
| **AI visibility tracking** | Weekly or daily checks of every prompt × engine through DataForSEO. Records whether the brand was named, its rank among the brands named, and whether its site was cited. |
| **Dashboard** | Sidebar app shell with workspace and brand switchers. The brand dashboard shows the AEO score ring, KPI cards with month-on-month deltas, AI presence per engine, key prompts, competitor landscape, strategy review, a carousel of prioritised recommendations (complete, dismiss or send to the task board), a full prompt-by-prompt report with every engine's answer, cited sources and query fan-outs, and an AI crawler checklist with semantic-HTML stats. Tabs cover Prompts, Sources, Competitors, Site audit, Reports and Brand settings. |
| **Monthly PDF reports** | A branded, multi-page PDF (score, KPIs vs last month, engines, share of voice, sources, prompt grid, site readiness, work delivered, next month's priorities). Download any month, email it on demand, or add recipients so it goes out automatically on the 1st of each month (sent once per brand per month). |
| **Cited sources** | The domains and pages AI engines cite for your prompts: the Reddit threads, listicles and directories to target. |
| **Site audit** | The AEO audit saved per brand, so it can be re-run over time. |
| **Done-for-you** | Task board (to do → in progress → review → done), a one-click 90-day onboarding plan, comments, internal-only tasks, and a deliverables log (articles, schema, llms.txt, Google Business posts, reports…). |
| **Client portal** | Read-only client logins. Clients see results, client-visible tasks and deliverables, and can comment. |
| **Billing** | Stripe Checkout for Starter/Growth/Agency (monthly or annual) and Done For You. The Stripe customer portal handles plan changes, cards, invoices and cancellation. Webhooks update the workspace plan automatically, and plan limits are enforced at run time after a downgrade. |
| **Accounts** | Forgot/reset password by email (1-hour single-use links; a reset signs out every other session), change password, and invite emails so new clients and teammates set their own password. |
| **Admin** (staff) | All workspaces, plans, done-for-you flag, list-price MRR, DataForSEO spend, and creating client workspaces with portal logins. |

## Design

The UI follows aeogrowthlead.com: navy `#0A1020`, cream `#FCF8F3`, flame `#FF5A1F`, teal `#0FB5A8`, Plus Jakarta Sans for headings and Inter for text (both self-hosted in `public/fonts`). Design tokens live at the top of `app/globals.css`. The logo and AI-engine icons in `public/brand` and `public/engines` come from the parent site.

## Plans

Defined in `lib/plans.ts`:

| Plan | Price | Limits |
|---|---|---|
| Free | $0 | 1 brand, 10 prompts, 2 engines, weekly |
| Starter | $49/mo | 1 brand, 50 prompts, 3 engines, weekly |
| Growth | $129/mo | 3 brands, 150 prompts, 4 engines, daily or weekly |
| Agency | $349/mo | 10 brands, 400 prompts, 5 engines, client logins |
| Done For You | from $799/mo | Full service plus the platform |

Limits are enforced when brands, prompts and engines are added, and again whenever a tracking run starts. Customers subscribe through Stripe on the Billing page. Staff can still set any plan by hand on the Admin page, e.g. for invoiced done-for-you clients. `npm run stripe:setup` creates the Stripe products and prices.

## How the tracking works

```
Hostinger cron (every 5 min) → GET /api/cron?key=…
  → start runs for brands whose next check is due (one check per prompt × engine)
  → claim pending checks (FOR UPDATE SKIP LOCKED, so overlapping ticks are safe)
  → ask the engine through DataForSEO → analyze → save → mark the run done
```

| Engine | DataForSEO endpoint | Approx. cost per check |
|---|---|---|
| ChatGPT | `ai_optimization/chat_gpt/llm_scraper/live/advanced` | $0.004 |
| Gemini | `ai_optimization/gemini/llm_scraper/live/advanced` | $0.004 |
| Google AI Mode | `serp/google/ai_mode/live/advanced` | ~$0.004 |
| Perplexity | `ai_optimization/perplexity/llm_responses/live` (sonar) | ~$0.01 |
| Claude | `ai_optimization/claude/llm_responses/live` (web search on) | ~$0.01–0.03 |

Costs are DataForSEO's published prices. The actual spend of each run is stored and shown on the Admin page. Without credentials the app runs in **demo mode** with simulated answers.

## Local development

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL (local Postgres or Supabase) and CRON_SECRET
npm run db:migrate
npm run dev                        # http://localhost:3000, then sign up (first account = admin)
curl "localhost:3000/api/cron?key=$CRON_SECRET"   # process queued checks
```

Deployment on Hostinger: see [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md).

## Project layout

```
app/
  page.tsx, free-audit.tsx, report.tsx   public free audit
  pricing/, login/, signup/              marketing + auth
  app/o/[orgId]/…                        workspace: brands, brand dashboard, checks, work (DFY), team
  admin/                                 staff admin
  actions/                               server actions (auth, brands, work/admin)
  api/cron, api/audit                    cron runner, audit API
lib/
  db/schema.ts                           Drizzle schema (Postgres); migrations in drizzle/
  auth.ts                                sessions, passwords, org access rules
  plans.ts, locations.ts                 plan limits, markets, prompt suggestions
  tracking/                              DataForSEO client, answer analysis, runner, metrics
  audit/                                 AEO site audit engine
```
