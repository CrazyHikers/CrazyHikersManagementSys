import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.discordSubscription.deleteMany({
    where: { userEmail: session.user.email },
  });

  return NextResponse.json({ success: true, removed: result.count });
}
