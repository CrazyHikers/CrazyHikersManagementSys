import webpush from "web-push";
import { db } from "@/lib/db";
import type { Channel, NotificationPayload, SendResult } from "../types";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Web push is not configured: missing NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT"
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// Push services return 410 (Gone) or 404 once a subscription is dead — the
// browser uninstalled the PWA, the user cleared site data, etc. We delete
// those rows so the table doesn't grow unbounded.
function isGone(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { statusCode?: number }).statusCode;
  return status === 404 || status === 410;
}

function formatPayload(payload: NotificationPayload): string {
  // Keep under ~4KB. Each channel knows how to render the kind-discriminated
  // payload in its own format; here we render for the service worker.
  switch (payload.kind) {
    case "activity_created":
      return JSON.stringify({
        title: "Crazy Hikers",
        body: `新活动发布 / New activity: ${payload.activityTitle}`,
        url: payload.url,
        icon: "/icon.png",
        tag: `activity-created-${payload.activityId}`,
      });
    case "registration_confirmed":
      return JSON.stringify({
        title: "Crazy Hikers",
        body: `报名已确认 / Registration confirmed: ${payload.activityTitle}`,
        url: payload.url,
        icon: "/icon.png",
        tag: `activity-${payload.activityId}`,
      });
    case "test":
      return JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
        icon: "/icon.png",
      });
  }
}

async function sendToOne(
  endpoint: string,
  p256dh: string,
  auth: string,
  body: string
): Promise<"delivered" | "gone" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      body,
      { TTL: 60 * 60 * 24 } // 1 day — keep queued if browser offline
    );
    return "delivered";
  } catch (err) {
    if (isGone(err)) return "gone";
    console.error("[push] send failed:", err);
    return "failed";
  }
}

// Send a payload to a single web-push subscription (looked up by endpoint).
// Used for actions whose target is a specific device rather than a user —
// e.g. the welcome push fired when a device subscribes for the first time.
// Stale subscriptions are cleaned up the same way as in the fan-out path.
export async function sendWebPushToEndpoint(
  endpoint: string,
  payload: NotificationPayload
): Promise<void> {
  ensureConfigured();
  const sub = await db.webPushSubscription.findUnique({ where: { endpoint } });
  if (!sub) return;

  const result = await sendToOne(
    sub.endpoint,
    sub.p256dh,
    sub.auth,
    formatPayload(payload)
  );

  if (result === "gone") {
    await db.webPushSubscription
      .delete({ where: { endpoint } })
      .catch(() => {});
  } else if (result === "delivered") {
    await db.webPushSubscription
      .update({ where: { endpoint }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
}

export const webPushChannel: Channel = {
  id: "web-push",
  async send(userEmail, payload): Promise<SendResult> {
    ensureConfigured();

    const subs = await db.webPushSubscription.findMany({ where: { userEmail } });
    if (subs.length === 0) {
      return { channel: "web-push", attempted: 0, delivered: 0, removed: 0 };
    }

    const body = formatPayload(payload);
    const results = await Promise.all(
      subs.map((s) => sendToOne(s.endpoint, s.p256dh, s.auth, body))
    );

    const deadEndpoints = subs
      .filter((_, i) => results[i] === "gone")
      .map((s) => s.endpoint);

    if (deadEndpoints.length > 0) {
      await db.webPushSubscription.deleteMany({
        where: { endpoint: { in: deadEndpoints } },
      });
    }

    const deliveredEndpoints = subs
      .filter((_, i) => results[i] === "delivered")
      .map((s) => s.endpoint);
    if (deliveredEndpoints.length > 0) {
      await db.webPushSubscription.updateMany({
        where: { endpoint: { in: deliveredEndpoints } },
        data: { lastUsedAt: new Date() },
      });
    }

    return {
      channel: "web-push",
      attempted: subs.length,
      delivered: results.filter((r) => r === "delivered").length,
      removed: deadEndpoints.length,
    };
  },
};
