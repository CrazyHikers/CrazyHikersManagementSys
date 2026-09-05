# Inbound signup email Worker

This Worker receives on-site signup verification emails through Cloudflare Email Routing and sends a signed callback to the website. It does not send email through Resend.

## Manual deployment

Run these steps while authenticated to the Cloudflare account that owns
`crazyhikers.ch`; repository setup does not deploy or modify Email Routing.

1. Apply the website Prisma migration.
2. Generate one strong random secret. Add these website environment variables
   and redeploy the website:
   - `INBOUND_SIGNUP_ADDRESS=join@crazyhikers.ch`
   - `INBOUND_SIGNUP_WEBHOOK_SECRET=<random secret>`
3. Confirm `SIGNUP_ADDRESS` and `SITE_CALLBACK_URL` in `wrangler.jsonc`.
4. In this directory, run `npm ci`, `npm run check`, and `npm run deploy`.
5. Add the same secret to the deployed Worker with
   `npx wrangler secret put SIGNUP_WEBHOOK_SECRET` (or through the Cloudflare
   dashboard under Worker settings).
6. In Cloudflare Email Routing, create a custom-address rule sending
   `join@crazyhikers.ch` to the `crazy-hikers-inbound-signup` Worker.
7. Sign in as a `dev` user, open dashboard settings, choose an event code and
   expiry, then enable on-site signup mode.

Disable the mode from dev settings after the event. While the switch is on but
expired or misconfigured, signup fails closed and does not fall back to Resend.

Use a separate receiving subdomain instead if the root domain already has MX records that must remain with another mailbox provider.
