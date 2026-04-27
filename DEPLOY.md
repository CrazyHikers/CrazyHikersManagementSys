# Crazy Hiker — Deployment Guide

This guide walks you through deploying the Crazy Hiker website from scratch. It assumes no prior experience with these services.

The current stack is **Next.js 16 + Vercel + Neon Postgres + Cloudflare R2 + Resend + Cloudflare Turnstile**. All services have free tiers sufficient for a small club.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a GitHub Repository](#2-create-a-github-repository)
3. [Set Up Resend (Email)](#3-set-up-resend-email)
4. [Set Up Cloudflare R2 (File Storage)](#4-set-up-cloudflare-r2-file-storage)
5. [Set Up Cloudflare Turnstile (Bot Protection)](#5-set-up-cloudflare-turnstile-bot-protection)
6. [Generate Secrets](#6-generate-secrets)
7. [Deploy to Vercel (with Neon Postgres)](#7-deploy-to-vercel-with-neon-postgres)
8. [Run Migrations and Seed the First Admin](#8-run-migrations-and-seed-the-first-admin)
9. [Verify Everything Works](#9-verify-everything-works)
10. [Custom Domain (Optional)](#10-custom-domain-optional)
11. [Running Locally for Development](#11-running-locally-for-development)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

Install on your computer:

- **Node.js 20+** — https://nodejs.org (LTS)
- **Git** — https://git-scm.com
- **A terminal** — PowerShell, Git Bash, or Windows Terminal

Create accounts on these services (all free to start):

| Service | Purpose |
|---------|---------|
| **GitHub** — https://github.com | Host your code |
| **Vercel** — https://vercel.com | Host the website (sign in with GitHub) |
| **Neon** — https://neon.tech | Postgres database (provisioned via Vercel — see step 7) |
| **Resend** — https://resend.com | Send emails (magic links, notifications) |
| **Cloudflare** — https://dash.cloudflare.com/sign-up | Storage (R2) and bot protection (Turnstile) |

---

## 2. Create a GitHub Repository

1. Go to https://github.com/new
2. Name it (e.g., `crazy-hiker-web`)
3. **Private** is fine; you can make it public later
4. Do NOT initialize with README
5. Click **Create repository**

Push the existing code:

```bash
cd C:\Users\yanks\Documents\Projects\CH\web

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-org-or-username>/<your-repo>.git
git push -u origin main
```

---

## 3. Set Up Resend (Email)

Resend sends magic-link logins, password resets, and all member notifications.

### 3.1 Create an API key

1. Sign up at https://resend.com
2. **API Keys** → **Create API Key**
3. Name: `crazy-hiker-production`, Permission: **Sending access**
4. Copy the key (starts with `re_`) — save for step 7

### 3.2 Verify a sending domain (recommended)

By default, Resend lets you send only from `onboarding@resend.dev` (test domain, low rate limits).

For production:

1. **Domains** → **Add Domain** → enter your domain (e.g., `crazyhiker.com`)
2. Add the DNS records (MX, TXT, DKIM) Resend shows you
3. Wait a few minutes for verification

You will set `RESEND_FROM_EMAIL` to something like `Crazy Hikers <noreply@crazyhiker.com>` in step 7.

If you don't have a domain yet, you can launch with `onboarding@resend.dev` and add the domain later.

---

## 4. Set Up Cloudflare R2 (File Storage)

R2 stores cover images, waiver PDFs, and QR codes.

### 4.1 Create a bucket

1. https://dash.cloudflare.com → **R2 Object Storage**
2. **Create bucket** — name it `crazy-hiker` (or anything; remember the name)
3. Pick a region close to your users

### 4.2 Enable public access

1. Open the bucket → **Settings**
2. Under **Public access**, click **Allow Access**
3. Copy the public URL (`https://pub-xxxxxxxxxxxxxxxx.r2.dev`) — this is `R2_PUBLIC_URL`

### 4.3 Create API credentials

1. R2 main page → **Manage R2 API Tokens**
2. **Create API token** — Permissions: **Object Read & Write**, scoped to your bucket
3. Save these three values (the secret is shown only once):
   - **Account ID** (top of the page) → `R2_ACCOUNT_ID`
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

### 4.4 Configure CORS (required for browser uploads)

Bucket → **Settings** → **CORS Policy** → **Add rule**:

- Allowed Origins: `https://<your-vercel-domain>` (or `*` for now)
- Allowed Methods: `GET`, `PUT`, `POST`, `DELETE`
- Allowed Headers: `*`
- Max Age: `86400`

---

## 5. Set Up Cloudflare Turnstile (Bot Protection)

Turnstile protects the public signup and login forms from bot abuse.

1. https://dash.cloudflare.com → **Turnstile** → **Add site**
2. Domain: your Vercel domain (you can edit later)
3. Widget mode: **Managed** (recommended)
4. Save these two values:
   - **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (safe to expose; it's public)
   - **Secret Key** → `TURNSTILE_SECRET_KEY` (server-only)

> For local dev, Cloudflare publishes always-pass test keys you can use without creating a site:
> - Site Key: `1x00000000000000000000AA`
> - Secret: `1x0000000000000000000000000000000AA`

---

## 6. Generate Secrets

You need two random secrets. In your terminal:

```bash
# AUTH_SECRET (signs Auth.js sessions)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# CRON_SECRET (authenticates Vercel Cron requests)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy each output — you'll paste them in step 7.

---

## 7. Deploy to Vercel (with Neon Postgres)

### 7.1 Import the repo

1. https://vercel.com/new
2. **Import Git Repository** → pick your repo
3. Framework: **Next.js** (auto-detected)
4. Root directory: `.` (leave default)
5. Build Command: leave default (`next build` — `prisma generate` runs via the `postinstall` script)

**Don't click Deploy yet** — set up the database first.

### 7.2 Provision Neon Postgres via Vercel Storage

This is the easiest path: Vercel will auto-inject the database env vars.

1. In your new project, open the **Storage** tab → **Create Database** → **Neon (Postgres)**
2. Pick a region near your users (Vercel project region is set to `fra1`/Frankfurt in `vercel.json`; pick something close, e.g. `eu-central-1`)
3. Connect it to your project
4. Vercel injects these automatically into the project's env vars:
   - `POSTGRES_PRISMA_URL` (pooled — used by the app)
   - `POSTGRES_URL_NON_POOLING` (direct — used for migrations)

### 7.3 Add the remaining environment variables

In **Settings** → **Environment Variables**, add the rest. All target **Production**, **Preview**, and **Development** unless noted.

| Variable | Value |
|----------|-------|
| `AUTH_SECRET` | The first secret from step 6 |
| `AUTH_URL` | Your Vercel URL (e.g. `https://crazy-hiker.vercel.app`) — update after first deploy |
| `RESEND_API_KEY` | From step 3 (`re_xxxxxxxxxxxxxxxxxxxxxxxx`) |
| `RESEND_FROM_EMAIL` | e.g. `Crazy Hikers <noreply@crazyhiker.com>` (or `Crazy Hikers <onboarding@resend.dev>` for testing) |
| `R2_ACCOUNT_ID` | From step 4.3 |
| `R2_ACCESS_KEY_ID` | From step 4.3 |
| `R2_SECRET_ACCESS_KEY` | From step 4.3 |
| `R2_BUCKET_NAME` | e.g. `crazy-hiker` |
| `R2_PUBLIC_URL` | From step 4.2 (`https://pub-xxxxxxxxxxxxxxxx.r2.dev`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | From step 5 |
| `TURNSTILE_SECRET_KEY` | From step 5 |
| `CRON_SECRET` | The second secret from step 6 |
| `GITHUB_FEEDBACK_REPO` | `<owner>/<repo>` where in-app feedback issues should land (e.g. `CrazyHikers/CrazyHikersManagementSys`) |
| `GITHUB_FEEDBACK_TOKEN` | Fine-grained PAT for the feedback repo (see [§7.3.1](#731-create-the-feedback-pat)). Starts with `github_pat_...` |

> **Never paste real values into the repo, this guide, or Slack.** They belong only in Vercel's env settings (and your local `.env`, which is gitignored).

#### 7.3.1 Create the feedback PAT

The in-app feedback form (footer link, signed-in users only) creates a GitHub issue on submission. Generate a token scoped to one repo:

1. https://github.com/settings/personal-access-tokens/new
2. **Resource owner:** the org/user that owns your feedback repo (e.g. `CrazyHikers`)
3. **Repository access:** *Only select repositories* → pick the feedback repo
4. **Repository permissions:** **Issues → Read and write**. Leave everything else as *No access*
5. **Expiration:** 1 year (calendar reminder to rotate)
6. Generate → copy the `github_pat_...` token → paste into `GITHUB_FEEDBACK_TOKEN`

Also create three labels in the feedback repo so the API call succeeds and submissions are easy to triage:

- `from-app` — applied to every submission
- `bug` — for bug reports
- `enhancement` — for feature requests
- `feedback` — for "other"

(Default repos already have `bug` and `enhancement`. Add `from-app` and `feedback` manually under **Issues → Labels**.)

### 7.4 First deploy

Click **Deploy** and wait 1–2 minutes. You'll get a URL like `https://crazy-hiker.vercel.app`.

After the first deploy, update `AUTH_URL` to that URL and redeploy from **Deployments** → ⋯ → **Redeploy**.

---

## 8. Run Migrations and Seed the First Admin

The Prisma schema lives at `prisma/schema.prisma`. Migrations live at `prisma/migrations/`.

### 8.1 Apply migrations

From your local machine, with `.env` populated (see step 11):

```bash
cd C:\Users\yanks\Documents\Projects\CH\web
npx prisma migrate deploy
```

This applies every checked-in migration to your Neon database. Run it again any time you pull new migrations.

> If you're starting from a fresh schema and there are no migrations yet, run `npx prisma migrate dev --name init` instead — it generates the initial migration AND applies it.

### 8.2 Seed the first admin

The first admin must be inserted directly. Open Neon's SQL console (Vercel → Storage → your Neon DB → **Query**) or run via `psql`:

```sql
INSERT INTO users (email, uid, name, role)
VALUES ('you@example.com', gen_random_uuid()::text, 'Your Name', 'dev');
```

Roles: `dev` > `admin` > `manager` > `member`. `dev` is the highest tier; use it for the first account so you can promote others from the dashboard.

App settings (ban durations, promotion thresholds, KPI config) fall back to code defaults until you customize them via the **Settings** page.

---

## 9. Verify Everything Works

### 9.1 Public pages
- Visit your Vercel URL — you should see the activity list (Chinese by default, EN toggle in the header).

### 9.2 Sign in
- Go to `/zh/signin`, enter your admin email, request a magic link.
- Check the inbox; click the link → you should land on the dashboard.

### 9.3 File upload
- Dashboard → **Activities** → **Create Activity** — upload a cover image. It should land in R2 and render.

### 9.4 Cron jobs

`vercel.json` declares three cron jobs:

| Path | Schedule (UTC) | Purpose |
|------|----------------|---------|
| `/api/cron/waivers` | Daily 01:00 | Expire/refresh waivers |
| `/api/cron/promotions` | Daily 02:00 | Close finished promotion votes |
| `/api/cron/kpi` | Yearly Nov 1 03:00 | Snapshot manager KPI |

To trigger one manually:

```bash
curl https://<your-url>/api/cron/waivers \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Vercel Hobby allows daily cron schedules; the yearly KPI job is also fine.

### 9.5 Database
If you see connection errors in Vercel logs, check that **Storage** still shows the Neon DB connected and that `POSTGRES_PRISMA_URL` is present in env vars. (Vercel re-syncs these automatically; if they're missing, click **Connect Project** on the Neon DB.)

---

## 10. Custom Domain (Optional)

### On Vercel
1. **Settings** → **Domains** → enter `www.crazyhiker.com` (and the apex `crazyhiker.com`).
2. Vercel shows the DNS records to add at your registrar.

### On your DNS provider
Typical records:
- **CNAME** `www` → `cname.vercel-dns.com`
- **A** `@` → `76.76.21.21` (Vercel will show the actual IP)

### After DNS propagates (5–60 min)
1. Update `AUTH_URL` in Vercel env vars to `https://www.crazyhiker.com`
2. Update R2 CORS to include the new origin
3. Add the domain in Cloudflare Turnstile site settings
4. Redeploy

---

## 11. Running Locally for Development

```bash
cd C:\Users\yanks\Documents\Projects\CH\web

# Install
npm install         # also runs `prisma generate` via postinstall

# Start
npm run dev         # http://localhost:3000
```

Create a local `.env` (gitignored) with the same variables as production, but:

- `AUTH_URL="http://localhost:3000"`
- For DB, you can either:
  - **Use the same Neon DB** as production (simplest; real data) — paste both `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` from Vercel into your `.env`.
  - **Use a separate Neon branch** (recommended) — create a dev branch in the Neon dashboard and use its connection string. Lets you experiment without touching production data.
- For Turnstile, use the test keys from step 5.

### Useful commands

```bash
npx prisma studio               # Browse the database (http://localhost:5555)
npx prisma migrate dev          # Create + apply a new migration after schema edits
npx prisma migrate deploy       # Apply existing migrations (production)
npm run lint                    # ESLint
npm run build                   # Same build Vercel runs
```

---

## 12. Troubleshooting

### Build fails with "Module not found" or Prisma errors
```bash
rm -rf node_modules .next src/generated
npm install
npm run build
```

### Database connection errors
- Confirm `POSTGRES_PRISMA_URL` is set in Vercel env vars (Storage tab → Neon → **Connect Project** if missing).
- Neon auto-suspends idle databases on the free tier; the first request after a quiet period may take a few seconds. Retry.

### Email not sending
- `RESEND_API_KEY` correct? Test it at https://resend.com/emails (logs every send attempt).
- Sending domain verified, or are you still using `onboarding@resend.dev`?
- Check the Vercel function logs for the route that triggered the email.

### File upload fails
- All five `R2_*` env vars set?
- Bucket CORS includes your origin (step 4.4)?
- API token has **read & write** on the bucket?

### Magic link doesn't work
- `AUTH_SECRET` set?
- `AUTH_URL` matches your actual domain exactly (no trailing slash, correct protocol)?
- The email exists in the `users` table (or signup is open)?

### Cron job didn't run
- Vercel dashboard → **Cron Jobs** tab shows execution history and errors.
- The route returns 401 if `CRON_SECRET` doesn't match — check the env var.
