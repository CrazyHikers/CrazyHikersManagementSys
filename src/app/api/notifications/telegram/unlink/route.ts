import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Unlink the Telegram subscription on this user's account. Note: this only
// removes the server-side row — the user can still re-link without any
// further action on the Telegram side, since the bot doesn't track its own
// "blocked" state. They'd need to /block the bot in Telegram to fully cut
// the connection from both ends.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.telegramSubscription.deleteMany({
    where: { userEmail: session.user.email },
  });

  return NextResponse.json({ success: true, removed: result.count });
}
