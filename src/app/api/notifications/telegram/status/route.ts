import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await db.telegramSubscription.findUnique({
    where: { userEmail: session.user.email },
    select: { username: true, createdAt: true },
  });

  return NextResponse.json({
    linked: !!sub,
    username: sub?.username ?? null,
    linkedAt: sub?.createdAt.toISOString() ?? null,
    configured: !!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
  });
}
