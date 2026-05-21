import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const PWRESET_PREFIX = "pwreset:";

export async function POST(req: NextRequest) {
  try {
    const { email, token, password } = await req.json();

    if (
      !email || typeof email !== "string" ||
      !token || typeof token !== "string" ||
      !password || typeof password !== "string"
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const { allowed } = await rateLimit(`pwreset-confirm:${email}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const identifier = `${PWRESET_PREFIX}${email}`;
    const record = await db.verificationToken.findUnique({
      where: { identifier_token: { identifier, token } },
    });

    if (!record || record.expires < new Date()) {
      // Same generic message regardless of cause — don't help an attacker
      // distinguish "expired" from "never existed".
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    // Single-use: delete first so a duplicate submit can't reuse the token.
    await db.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });

    const passwordHash = await bcrypt.hash(password, 12);
    // Upsert handles both flows: signup (no row yet) and reset (row exists).
    // The token grant proves email ownership, which is enough to either
    // create or replace the account credentials.
    await db.user.upsert({
      where: { email },
      create: { email, name: "", role: "member", passwordHash },
      update: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PWRESET-CONFIRM] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
