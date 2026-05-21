import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendWelcomeSignupEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getBaseUrl } from "@/lib/url";

// Signup tokens share the verification_tokens table with password resets.
// Same prefix as reset because the downstream /api/auth/reset-password
// endpoint upserts the user — first-password and reset are functionally
// the same operation, distinguished only by whether a row exists yet.
const PWRESET_PREFIX = "pwreset:";
const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email, turnstileToken, locale } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    if (!turnstileToken || typeof turnstileToken !== "string") {
      return NextResponse.json({ error: "Bot verification required" }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(turnstileToken);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Bot verification failed" }, { status: 400 });
    }

    const { allowed } = await rateLimit(`signup:${email}`, {
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    // Always return 200. If an account already exists with a password, we
    // silently do nothing — sending a welcome email to an existing account
    // would confuse the real owner. The legitimate user who forgot they
    // already had an account can use the forgot-password flow.
    const existing = await db.user.findUnique({ where: { email } });
    if (existing?.passwordHash) {
      return NextResponse.json({ ok: true });
    }

    // Deliberately DO NOT create a users row here. The signup is "pending"
    // until the user clicks the link and sets a password — the
    // verification_tokens row is the only state. If they never click,
    // the row expires and nothing remains in the database.
    const token = crypto.randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + TOKEN_TTL_MS);

    await db.verificationToken.create({
      data: {
        identifier: `${PWRESET_PREFIX}${email}`,
        token,
        expires,
      },
    });

    const baseUrl = getBaseUrl();
    const localePart = locale === "en" ? "en" : "zh";
    const url = `${baseUrl}/${localePart}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    await sendWelcomeSignupEmail(email, url).catch((err) => {
      console.error("[SIGNUP] email send failed:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[SIGNUP] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
