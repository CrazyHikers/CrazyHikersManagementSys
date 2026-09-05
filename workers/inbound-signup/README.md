# Inbound signup email Worker

This Worker receives on-site signup verification emails through Cloudflare Email Routing. A single Durable Object holds every pending attempt for the active recruitment session, so unmatched email is dropped before it can call the website or database. It does not send email through Resend.

## Manual deployment

Run these steps while authenticated to the Cloudflare account that owns
`crazyhikers.ch`; repository setup does not deploy or modify Email Routing.

1. Apply the website Prisma migration.
2. Generate one strong random secret. Add these website environment variables
   and redeploy the website:
   - `INBOUND_SIGNUP_ADDRESS=join@signup.crazyhikers.ch`
   - `INBOUND_SIGNUP_WEBHOOK_SECRET=<random secret>`
   - `INBOUND_SIGNUP_WORKER_URL=<the deployed workers.dev URL>`
3. Confirm `SIGNUP_ADDRESS` and `SITE_CALLBACK_URL` in `wrangler.jsonc`.
4. In this directory, run `npm ci`, `npm run check`, and `npm run deploy`.
5. Add the same secret to the deployed Worker with
   `npx wrangler secret put SIGNUP_WEBHOOK_SECRET` (or through the Cloudflare
   dashboard under Worker settings).
6. In Cloudflare Email Routing, create a custom-address rule sending
   `join@signup.crazyhikers.ch` to the `crazy-hikers-inbound-signup` Worker.
7. Sign in as a `dev` user, open dashboard settings, choose an expiry, then
   enable on-site signup mode. This opens and schedules expiry for the Worker session.

Disable the mode from dev settings after the event. This closes the Durable Object
session and clears its pending attempts. While the switch is on but
expired or misconfigured, signup fails closed and does not fall back to Resend.

The dedicated `signup.crazyhikers.ch` receiving subdomain keeps the root domain's
existing SimpleLogin MX records untouched.
