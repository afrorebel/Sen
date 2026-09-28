# Deploying AEOGrowthLeads on Hostinger (Cloud Startup)

The app is a Next.js (Node.js) web app with a Postgres database and a cron job that runs AI-visibility checks. Your Cloud Startup plan supports Node.js web apps and cron jobs. Postgres runs on Supabase, which has a free tier.

## 1. Create the database (Supabase, ~5 minutes)

1. Sign up at [supabase.com](https://supabase.com) and create a project. Pick the region closest to your Hostinger server and save the database password.
2. Open **Project Settings → Database → Connection string → URI**, and choose the **Session pooler** string.
3. Replace `[YOUR-PASSWORD]` in it with your database password. The result is your `DATABASE_URL`.

The tables are created automatically the first time the app starts.

## 2. Get your DataForSEO API credentials

In DataForSEO go to **API Access** (app.dataforseo.com/api-access). Copy the **API login** and **API password**; the API password is not your account password. Top up at least $50. The same balance pays for every API.

Until these are set, the app runs in **demo mode** with simulated answers, so you can click through it before you pay for anything.

## 3. Create the Node.js app on Hostinger

1. In hPanel, add a new website and choose **Node.js app** (Web Apps). Connect the GitHub repository `afrorebel/sen`, or upload the project as a zip.
2. Build settings:
   - **Node version:** 22.x
   - **Install command:** `npm ci` (or `npm install`)
   - **Build command:** `npm run build`
   - **Start command:** `npm start` (runs database migrations, then starts the app)
3. **Environment variables.** Add these in the app's settings; `.env.example` explains each one:
   - `DATABASE_URL`: from step 1
   - `CRON_SECRET`: a long random string, e.g. from a password generator
   - `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`: from step 2
   - `ADMIN_EMAIL`: the email you'll sign up with
   - Email and Stripe settings: see steps 4 and 5 (they can be added later)
4. Point **aeogrowthleads.com** at the app (hPanel → Domains) and turn on SSL.
5. Deploy. Visit `https://aeogrowthleads.com/signup` and create your account. The first account, and `ADMIN_EMAIL`, get **Admin** access.

## 4. Email for password resets and client invites

1. In hPanel open **Emails** and create a mailbox such as `hello@aeogrowthleads.com`.
2. Add these environment variables to the app, then redeploy:
   `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_USER=hello@aeogrowthleads.com`,
   `SMTP_PASSWORD=<mailbox password>`, `EMAIL_FROM=AEOGrowthLeads <hello@aeogrowthleads.com>` and
   `APP_URL=https://aeogrowthleads.com`.
3. Test it: log out, click **Forgot password?**, and check that the email arrives. If it lands in spam, turn on SPF/DKIM/DMARC for the domain in hPanel → Emails → DNS settings.

Until SMTP is set, emails are written to the app's log instead of being sent.

## 5. Stripe billing

1. In Stripe, stay in **Test mode** first. Go to **Developers → API keys** and copy the **Secret key** (`sk_test_…`).
2. On your computer, in the project folder, create the products and prices once:
   ```bash
   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
   ```
   This creates Starter, Growth and Agency (monthly and annual) and Done For You (monthly), priced as in `lib/plans.ts`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://aeogrowthleads.com/api/stripe/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_…`).
4. **Settings → Billing → Customer portal**: turn on "Customers can switch plans". Add the Starter, Growth and Agency prices to it, and allow cancellations and invoice history.
5. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the Hostinger app and redeploy.
6. Test: open **Billing** in the app, choose a plan, and pay with test card `4242 4242 4242 4242` (any future date, any CVC). You return to the Billing page and the plan changes within a few seconds.
7. To go live: repeat steps 1–5 with live keys (`sk_live_…`) and a live webhook.

## 6. Schedule the tracking cron job

In hPanel open **Advanced → Cron Jobs** and add a job that runs **every 5 minutes**:

```bash
curl -fsS "https://aeogrowthleads.com/api/cron?key=YOUR_CRON_SECRET" > /dev/null
```

Each call starts any brands that are due for their weekly or daily check. It then works through pending checks for about 50 seconds. A 50-prompt × 3-engine brand (150 checks) finishes within a few ticks.

## 7. Check it works

- `https://aeogrowthleads.com/api/cron?key=YOUR_CRON_SECRET` should return `{"ok":true,...}`.
- Add a brand, then open **Prompts**: results fill in as checks finish.
- The **Admin** page shows DataForSEO spend for the last 30 days.

## Updating

Push to GitHub and redeploy from hPanel, or re-upload. Migrations run automatically on start.
To change the database schema: edit `lib/db/schema.ts`, run `npm run db:generate`, then commit the new file in `drizzle/`.
