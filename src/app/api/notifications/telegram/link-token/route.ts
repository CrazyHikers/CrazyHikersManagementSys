import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Issues a one-time link token. The client opens
// https://t.me/<bot>?start=<token>; the bot's webhook handler then binds
// the chat to this user. The token row is consumed (`usedAt` set) on bind.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!botUsername || !process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: "Telegram is not configured" },
      { status: 503 }
    );
  }

  // Lazy cleanup: delete this user's expired/unused tokens before issuing a
  // fresh one, so a user clicking "Link" repeatedly doesn't accumulate rows.
  await db.telegramLinkToken.deleteMany({
    where: {
      userEmail: session.user.email,
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
    },
  });

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const token = await db.telegramLinkToken.create({
    data: { userEmail: session.user.email, expiresAt },
  });

  const url = `https://t.me/${botUsername}?start=${token.id}`;
  return NextResponse.json({ url, expiresAt: expiresAt.toISOString() });
}
