import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

type UnsubscribeBody = {
  endpoint?: string;
  all?: boolean;
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UnsubscribeBody = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — caller may want `all`.
  }

  if (body.all) {
    const result = await db.webPushSubscription.deleteMany({
      where: { userEmail: session.user.email },
    });
    return NextResponse.json({ success: true, removed: result.count });
  }

  if (!body.endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint (or pass { all: true })" },
      { status: 400 }
    );
  }

  // Scope by userEmail so a user can only unsubscribe their own devices.
  const result = await db.webPushSubscription.deleteMany({
    where: { userEmail: session.user.email, endpoint: body.endpoint },
  });

  return NextResponse.json({ success: true, removed: result.count });
}
