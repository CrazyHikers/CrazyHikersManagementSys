import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notifyDevice } from "@/lib/notify";

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

  // Fire a confirmation push to *this* device only, not the user's other
  // subscribed devices — those devices didn't just enable anything, so a
  // global welcome would be confusing. Wrapped in `after()` so Vercel
  // keeps the function alive until the push completes; a bare promise
  // would risk being killed when the response is returned, which earlier
  // showed up as multi-minute delivery delays. Welcome pushes don't
  // belong to any toggleable kind, so we pass meta directly.
  after(async () => {
    try {
      await notifyDevice(body.endpoint, {
        title: "Crazy Hikers",
        body: "此设备已启用推送通知 / Push notifications enabled on this device",
        link: "/dashboard/my-profile",
      });
    } catch (err) {
      console.error("[subscribe] welcome push failed:", err);
    }
  });

  return NextResponse.json({ success: true });
}
