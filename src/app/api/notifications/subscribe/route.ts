import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notify } from "@/lib/notify";

type SubscribeBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json(
      { error: "Missing endpoint or keys" },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get("user-agent") ?? null;

  // Upsert by endpoint — if the same browser re-subscribes, we update its
  // owner rather than duplicating. Endpoint is globally unique per device.
  await db.webPushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      userEmail: session.user.email,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent,
    },
    update: {
      userEmail: session.user.email,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent,
    },
  });

  // Fire a confirmation push so the user sees the system working immediately.
  // Failures here are non-fatal — the subscription is already saved.
  notify(session.user.email, {
    kind: "test",
    title: "Crazy Hikers",
    body: "推送通知已启用 / Push notifications enabled",
    url: "/dashboard/my-profile",
  }).catch((err) => console.error("[subscribe] welcome push failed:", err));

  return NextResponse.json({ success: true });
}
