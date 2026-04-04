# Crazy Hiker - Deployment Guide

This guide walks you through deploying the Crazy Hiker website from scratch. It assumes you have no prior experience with these services.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a GitHub Repository](#2-create-a-github-repository)
3. [Set Up Resend (Email Service)](#3-set-up-resend-email-service)
4. [Set Up Cloudflare R2 (File Storage)](#4-set-up-cloudflare-r2-file-storage)
5. [Generate Secrets](#5-generate-secrets)
6. [Set Up the Database Tables](#6-set-up-the-database-tables)
7. [Deploy to Vercel](#7-deploy-to-vercel)
8. [Configure Environment Variables on Vercel](#8-configure-environment-variables-on-vercel)
9. [Verify Everything Works](#9-verify-everything-works)
10. [Custom Domain (Optional)](#10-custom-domain-optional)
11. [Running Locally for Development](#11-running-locally-for-development)

---

## 1. Prerequisites

You need the following installed on your computer:

- **Node.js 20+** — Download from https://nodejs.org (choose the LTS version)
- **Git** — Download from https://git-scm.com
- **A terminal** — PowerShell, Git Bash, or Windows Terminal all work

You also need accounts on these services (all have free tiers):

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **GitHub** | Host your code | https://github.com |
| **Vercel** | Host the website | https://vercel.com (sign up with GitHub) |
| **Resend** | Send emails (magic links, notifications) | https://resend.com |
| **Cloudflare** | Store files (cover images, waivers) | https://dash.cloudflare.com/sign-up |

Your **Aiven MySQL database** is already set up and running — no changes needed there.

---

## 2. Create a GitHub Repository

1. Go to https://github.com/new
2. Name it something like `crazy-hiker-web`
3. Set it to **Private**
4. Do NOT initialize with README (we already have code)
5. Click **Create repository**

Then in your terminal:

```bash
cd C:\Users\yanks\Documents\Projects\CH\web

git init
git add .
git commit -m "Initial commit: Crazy Hiker website"
git branch -M main
git remote add origin https://github.com/Yanksi/CrazyHiker.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## 3. Set Up Resend (Email Service)

Resend sends the magic link login emails and all notifications (registration confirmations, waiver reminders, etc.).

### 3.1 Create an API Key

1. Go to https://resend.com and sign up
2. Go to **API Keys** in the left sidebar
3. Click **Create API Key**
4. Name it `crazy-hiker-production`
5. Permission: **Sending access**
6. Copy the key (starts with `re_`) — you'll need it later

### 3.2 Verify a Sending Domain (recommended for production)

By default, Resend lets you send from `onboarding@resend.dev` for testing. For production:

1. Go to **Domains** in the left sidebar
2. Click **Add Domain**
3. Enter your domain (e.g., `crazyhiker.com`)
4. Follow the instructions to add DNS records (MX, TXT, DKIM)
5. Wait for verification (usually a few minutes)

If you don't have a custom domain yet, you can use Resend's test domain during development. The emails will come from `onboarding@resend.dev`.

> **Note:** Update the `FROM_EMAIL` in `src/lib/email.ts` to match your verified domain.

---

## 4. Set Up Cloudflare R2 (File Storage)

R2 stores cover images, waiver PDFs, and QR codes.

### 4.1 Create an R2 Bucket

1. Go to https://dash.cloudflare.com
2. In the left sidebar, click **R2 Object Storage**
3. Click **Create bucket**
4. Bucket name: `crazy-hiker`
5. Location: Choose the region closest to your users (e.g., APAC if your club is in Asia)
6. Click **Create bucket**

### 4.2 Enable Public Access

1. Go into your `crazy-hiker` bucket
2. Click the **Settings** tab
3. Under **Public access**, click **Allow Access**
4. You'll get a public URL like `https://pub-abc123def456.r2.dev`
5. Copy this URL — this is your `R2_PUBLIC_URL`

### 4.3 Create API Credentials

1. Go back to the R2 main page
2. Click **Manage R2 API Tokens** (on the right side)
3. Click **Create API token**
4. Name: `crazy-hiker-upload`
5. Permissions: **Object Read & Write**
6. Specify bucket: `crazy-hiker`
7. Click **Create API Token**
8. Copy these three values:
   - **Account ID** (shown at the top of the page) → `R2_ACCOUNT_ID`
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

> **Important:** The Secret Access Key is only shown once. Save it somewhere safe.

### 4.4 Configure CORS (required for browser uploads)

1. Go into your bucket → **Settings** tab
2. Scroll to **CORS Policy**
3. Click **Add rule** and enter:
   - **Allowed Origins**: `*` (or your specific domain like `https://crazyhiker.vercel.app`)
   - **Allowed Methods**: `GET`, `PUT`, `POST`, `DELETE`
   - **Allowed Headers**: `*`
   - **Max Age**: `86400`
4. Click **Save**

---

## 5. Generate Secrets

You need two random secrets. Run these commands in your terminal:

```bash
# Generate AUTH_SECRET (for login sessions)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate CRON_SECRET (for scheduled jobs)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy each output — you'll need them in step 8.

---

## 6. Set Up the Database Tables

The app needs new tables in your existing Aiven MySQL database (for verification tokens, member flags, app settings, etc.).

### Option A: Using Prisma Push (simplest)

First, create a local `.env` file with your database credentials (it's already partially filled in):

```bash
cd C:\Users\yanks\Documents\Projects\CH\web
```

Edit the `.env` file and make sure the database variables are correct, then run:

```bash
npx prisma db push
```

This will create all missing tables. It will show you what it's going to do and ask for confirmation.

### Option B: Using Prisma Migrate (recommended for production)

```bash
npx prisma migrate dev --name init
```

This creates a migration file (versioned SQL) that you can review. Then to apply it:

```bash
npx prisma migrate deploy
```

### Verify the Tables

You can check that tables were created:

```bash
npx prisma studio
```

This opens a web-based database browser at `http://localhost:5555`. You should see all the tables listed.

---

## 7. Deploy to Vercel

### 7.1 Connect to Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Select your `crazy-hiker-web` repository
4. Vercel will auto-detect it as a Next.js project

### 7.2 Configure Build Settings

Vercel should auto-detect these, but verify:

- **Framework Preset**: Next.js
- **Root Directory**: `.` (leave as default, since the project is at the repo root)
- **Build Command**: `npx prisma generate && next build`
- **Install Command**: `npm install`

> **Important:** The build command must include `npx prisma generate` to generate the database client before building.

### 7.3 Add Environment Variables

Before clicking Deploy, add ALL the environment variables. Click **Environment Variables** and add each one:

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_HOST` | Your Aiven host | `crazyhiker-yanksi-fa0d.e.aivencloud.com` |
| `DATABASE_PORT` | Your Aiven port | `21478` |
| `DATABASE_USER` | Your Aiven user | `avnadmin` |
| `DATABASE_PASSWORD` | Your Aiven password | `AVNS_LuwQ1jeNV-qi8lcp6A_` |
| `DATABASE_NAME` | Your database name | `defaultdb` |
| `DATABASE_URL` | Full connection string | `mysql://avnadmin:AVNS_LuwQ1jeNV-qi8lcp6A_@crazyhiker-yanksi-fa0d.e.aivencloud.com:21478/defaultdb` |
| `AUTH_SECRET` | Generated in step 5 | `aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789...` |
| `AUTH_URL` | Your Vercel URL | `https://crazy-hiker.vercel.app` |
| `RESEND_API_KEY` | From step 3 | `re_abc123...` |
| `R2_ACCOUNT_ID` | From step 4 | `abc123def456` |
| `R2_ACCESS_KEY_ID` | From step 4 | `abc123...` |
| `R2_SECRET_ACCESS_KEY` | From step 4 | `xyz789...` |
| `R2_BUCKET_NAME` | Your bucket name | `crazy-hiker` |
| `R2_PUBLIC_URL` | From step 4.2 | `https://pub-abc123.r2.dev` |
| `CRON_SECRET` | Generated in step 5 | `xYz789AbCdEfGhIjKlMnOpQrStUvWx...` |

### 7.4 Deploy

Click **Deploy** and wait. The first deploy takes 1-2 minutes.

Once done, you'll get a URL like `https://crazy-hiker.vercel.app`.

---

## 8. Configure Environment Variables on Vercel

If you need to update environment variables after deployment:

1. Go to your project on https://vercel.com
2. Click **Settings** → **Environment Variables**
3. Add or edit variables
4. After changes, go to **Deployments** → click the three dots on the latest → **Redeploy**

### Update AUTH_URL

After your first deploy, you'll know your Vercel URL. Make sure `AUTH_URL` matches it:

- If your URL is `https://crazy-hiker.vercel.app`, set `AUTH_URL` to `https://crazy-hiker.vercel.app`
- If you later add a custom domain, update this to match

---

## 9. Verify Everything Works

### 9.1 Public Pages

1. Visit your Vercel URL (e.g., `https://crazy-hiker.vercel.app`)
2. You should see the activity list page (in Chinese by default)
3. Click the "EN" button — it should switch to English
4. If there are activities in the database, they should appear

### 9.2 Manager Login

1. Visit `https://your-url/zh/admin/signin`
2. Enter a manager's email address (must exist in the `managers` table)
3. Check that email for a magic link
4. Click it — you should be logged in and see the admin dashboard

### 9.3 File Upload

1. Go to **Activities** → **Create Activity**
2. Try uploading a cover image
3. The image should upload to R2 and display

### 9.4 Cron Job

Vercel runs the waiver check cron daily at 1:00 AM UTC. To test it manually:

```bash
curl -X POST https://your-url/api/cron/waivers \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 9.5 Database

If you see errors about database connection:
- Check that your Aiven service is running
- Verify the database credentials in Vercel env vars
- Make sure your Aiven allows connections from Vercel's IPs (or set it to allow all IPs)

To allow all IPs on Aiven:
1. Go to your Aiven console → your MySQL service
2. Go to **Overview** → **Allowed IP Addresses**
3. Add `0.0.0.0/0` (allows all — Aiven still requires password auth)

---

## 10. Custom Domain (Optional)

### On Vercel

1. Go to your project → **Settings** → **Domains**
2. Enter your domain (e.g., `www.crazyhiker.com`)
3. Vercel will show you DNS records to add

### On Your DNS Provider

Add the records Vercel shows you. Typically:
- **CNAME** record: `www` → `cname.vercel-dns.com`
- Or an **A** record for the root domain

After DNS propagation (5-60 minutes):
1. Update `AUTH_URL` in Vercel env vars to `https://www.crazyhiker.com`
2. Update `R2_PUBLIC_URL` CORS settings to include your new domain
3. Redeploy

---

## 11. Running Locally for Development

```bash
cd C:\Users\yanks\Documents\Projects\CH\web

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start the dev server
npm run dev
```

The site runs at http://localhost:3000.

### Local Environment

Make sure your `.env` file has all the variables filled in. For local development:
- `AUTH_URL` should be `http://localhost:3000`
- Everything else stays the same as production (you're using the same database)

### Useful Commands

```bash
# Open the database browser
npx prisma studio

# Update database after schema changes
npx prisma db push

# Create a proper migration
npx prisma migrate dev --name describe_your_change

# Check for TypeScript errors
npm run lint

# Build locally (same as Vercel does)
npm run build
```

---

## Troubleshooting

### "Module not found" errors during build
```bash
npm install
npx prisma generate
npm run build
```

### Database connection errors
- Check Aiven service is running
- Verify all `DATABASE_*` env vars are correct
- Ensure Aiven allows your IP (add `0.0.0.0/0` for dev)

### Email not sending
- Check `RESEND_API_KEY` is set correctly
- Verify your sending domain in Resend dashboard
- Check Resend's logs at https://resend.com/emails

### File upload fails
- Verify all `R2_*` env vars are set
- Check R2 bucket CORS settings
- Ensure the API token has read & write permissions

### Auth magic link not working
- Ensure `AUTH_SECRET` is set
- Ensure `AUTH_URL` matches your actual domain exactly
- Check that the email address exists in the `managers` table
- Look at Vercel function logs for errors

### Cron job not running
- Vercel free tier supports 1 cron job (we have exactly 1)
- Check Vercel dashboard → **Cron Jobs** tab for execution logs
- Ensure `CRON_SECRET` matches what's in the env vars
