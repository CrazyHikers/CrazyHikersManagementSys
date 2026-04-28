import { db } from "@/lib/db";
import type {
  Channel,
  ChannelId,
  NotificationPayload,
  NotificationPreferences,
  SendResult,
  UserToggleableKind,
} from "./types";
import { DEFAULT_PREFS, USER_TOGGLEABLE_KINDS } from "./types";
import { webPushChannel, sendWebPushToEndpoint } from "./channels/web-push";

export type {
  NotificationPayload,
  NotificationKind,
  NotificationPreferences,
  ChannelId,
  SendResult,
  UserToggleableKind,
} from "./types";
export { USER_TOGGLEABLE_KINDS, DEFAULT_PREFS } from "./types";

const channels: Record<ChannelId, Channel> = {
  "web-push": webPushChannel,
};

function isUserToggleable(kind: string): kind is UserToggleableKind {
  return (USER_TOGGLEABLE_KINDS as readonly string[]).includes(kind);
}

// Resolve a user's effective prefs, applying defaults for missing keys.
export function resolvePrefs(
  raw: unknown
): Required<NotificationPreferences> {
  const prefs = (raw && typeof raw === "object" ? raw : {}) as NotificationPreferences;
  return {
    activity_created: prefs.activity_created ?? DEFAULT_PREFS.activity_created,
    registration_confirmed:
      prefs.registration_confirmed ?? DEFAULT_PREFS.registration_confirmed,
  };
}

async function userHasKindEnabled(
  userEmail: string,
  kind: NotificationPayload["kind"]
): Promise<boolean> {
  // `test` bypasses prefs — it's only used for the confirmation push when
  // the user explicitly subscribes a device.
  if (!isUserToggleable(kind)) return true;

  const user = await db.user.findUnique({
    where: { email: userEmail },
    select: { notificationPrefs: true },
  });
  if (!user) return false;
  const prefs = resolvePrefs(user.notificationPrefs);
  return prefs[kind];
}

// Send to a single device (web push only — Discord/WeChat have their own
// per-account models). Bypasses per-kind preferences since this is used
// for device-targeted confirmations like the post-subscribe welcome push.
export async function notifyDevice(
  endpoint: string,
  payload: NotificationPayload
): Promise<void> {
  await sendWebPushToEndpoint(endpoint, payload);
}

// Send to a single user. Respects their per-kind preferences.
export async function notify(
  userEmail: string,
  payload: NotificationPayload
): Promise<SendResult[]> {
  if (!(await userHasKindEnabled(userEmail, payload.kind))) {
    return [];
  }

  const results = await Promise.allSettled(
    Object.values(channels).map((c) => c.send(userEmail, payload))
  );

  const out: SendResult[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      out.push(r.value);
    } else {
      console.error("[notify] channel send rejected:", r.reason);
    }
  }
  return out;
}

// Fan out to every user who has at least one push subscription and hasn't
// opted out of this kind. Used for activity-wide announcements.
export async function broadcast(
  payload: NotificationPayload
): Promise<{ sent: number; skipped: number }> {
  // Pull subscribed users in one query, with their prefs, deduped by email.
  const subscribers = await db.user.findMany({
    where: { webPushSubscriptions: { some: {} } },
    select: { email: true, notificationPrefs: true },
  });

  let sent = 0;
  let skipped = 0;

  // Sequential to avoid hammering Neon's connection pool with hundreds of
  // parallel deliveries. Web push fan-out per user is already parallel.
  for (const user of subscribers) {
    if (isUserToggleable(payload.kind)) {
      const prefs = resolvePrefs(user.notificationPrefs);
      if (!prefs[payload.kind]) {
        skipped++;
        continue;
      }
    }

    try {
      await Promise.all(
        Object.values(channels).map((c) => c.send(user.email, payload))
      );
      sent++;
    } catch (err) {
      console.error("[broadcast] failed for", user.email, err);
    }
  }

  return { sent, skipped };
}
