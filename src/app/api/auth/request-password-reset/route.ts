import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getBaseUrl } from "@/lib/url";

// Identifier prefix keeps password-reset tokens from colliding with Auth.js's
// own magic-link tokens that share the same `verification_tokens` table.
const PWRESET_PREFIX = "pwreset:";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

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

    const { allowed } = await rateLimit(`pwreset:${email}`, {
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    // Always return 200 regardless of whether the user exists. Don't leak
    // account existence to bots probing the endpoint.
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ ok: true });
    }

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

    await sendPasswordResetEmail(email, url).catch((err) => {
      console.error("[PWRESET] email send failed:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PWRESET] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
