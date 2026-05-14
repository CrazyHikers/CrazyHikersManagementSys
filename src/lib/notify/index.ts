import { db } from "@/lib/db";
import type {
  Channel,
  ChannelId,
  NotificationDispatch,
  NotificationKind,
  NotificationMeta,
  NotificationPreferences,
  SendResult,
  UserToggleableKind,
} from "./types";
import { DEFAULT_PREFS, USER_TOGGLEABLE_KINDS } from "./types";
import { webPushChannel, sendWebPushToEndpoint } from "./channels/web-push";
import { telegramChannel } from "./channels/telegram";
import { discordChannel } from "./channels/discord";

export type {
  NotificationDispatch,
  NotificationKind,
  NotificationMeta,
  NotificationPreferences,
  ChannelId,
  SendResult,
  UserToggleableKind,
  MemberKind,
  ManagerKind,
} from "./types";
export {
  USER_TOGGLEABLE_KINDS,
  MEMBER_KINDS,
  MANAGER_KINDS,
  DEFAULT_PREFS,
} from "./types";

// Re-export the dispatch builders so callers have a single import surface.
export {
  activityCreatedDispatch,
  registrationConfirmedDispatch,
  comanagerInvitedDispatch,
  comanagerResponseDispatch,
  confirmRegistrationsReminderDispatch,
  finalizeActivityReminderDispatch,
} from "./messages";

const channels: Record<ChannelId, Channel> = {
  "web-push": webPushChannel,
  telegram: telegramChannel,
  discord: discordChannel,
};

// Mute push delivery (web push, Telegram, Discord) on any non-production
// deploy so preview branches and local dev don't reach real members'
// devices when test activities are created or confirmed. Email — including
// self-directed sign-in / password-reset links — is unaffected.
function pushMuted(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

function isUserToggleable(kind: NotificationKind): kind is UserToggleableKind {
  return (USER_TOGGLEABLE_KINDS as readonly NotificationKind[]).includes(kind);
}

// Resolve a user's effective prefs, applying defaults for missing keys.
// Iterates DEFAULT_PREFS so adding a new toggleable kind doesn't require
// touching this function — just extend the type union and DEFAULT_PREFS.
export function resolvePrefs(
  raw: unknown
): Required<NotificationPreferences> {
  const prefs = (raw && typeof raw === "object"
    ? raw
    : {}) as NotificationPreferences;
  const out = {} as Required<NotificationPreferences>;
  for (const key of Object.keys(DEFAULT_PREFS) as UserToggleableKind[]) {
    out[key] = prefs[key] ?? DEFAULT_PREFS[key];
  }
  return out;
}

async function userHasKindEnabled(
  userEmail: string,
  kind: NotificationKind
): Promise<boolean> {
  if (!isUserToggleable(kind)) return true;

  const user = await db.user.findUnique({
    where: { email: userEmail },
    select: { notificationPrefs: true },
  });
  if (!user) return false;
  const prefs = resolvePrefs(user.notificationPrefs);
  return prefs[kind];
}

// Send a meta to a single device (web push only — Discord/WeChat have their
// own per-account models). Bypasses preferences since this is used for
// device-targeted confirmations like the post-subscribe welcome push, where
// pref-filtering is irrelevant: the user just enabled push on this device.
export async function notifyDevice(
  endpoint: string,
  meta: NotificationMeta
): Promise<void> {
  if (pushMuted()) {
    console.log("[notify] notifyDevice muted (non-production deploy)");
    return;
  }
  await sendWebPushToEndpoint(endpoint, meta);
}

// Send to a single user. Respects their per-kind preferences.
export async function notify(
  userEmail: string,
  dispatch: NotificationDispatch
): Promise<SendResult[]> {
  if (pushMuted()) {
    console.log(`[notify] muted (non-production deploy) — ${dispatch.kind} -> ${userEmail}`);
    return [];
  }
  if (!(await userHasKindEnabled(userEmail, dispatch.kind))) {
    return [];
  }

  const results = await Promise.allSettled(
    Object.values(channels).map((c) => c.send(userEmail, dispatch.meta))
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
  dispatch: NotificationDispatch
): Promise<{ sent: number; skipped: number }> {
  if (pushMuted()) {
    console.log(`[notify] broadcast muted (non-production deploy) — ${dispatch.kind}`);
    return { sent: 0, skipped: 0 };
  }
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
    if (isUserToggleable(dispatch.kind)) {
      const prefs = resolvePrefs(user.notificationPrefs);
      if (!prefs[dispatch.kind]) {
        skipped++;
        continue;
      }
    }

    try {
      await Promise.all(
        Object.values(channels).map((c) => c.send(user.email, dispatch.meta))
      );
      sent++;
    } catch (err) {
      console.error("[broadcast] failed for", user.email, err);
    }
  }

  return { sent, skipped };
}
