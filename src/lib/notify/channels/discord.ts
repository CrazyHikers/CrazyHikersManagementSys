import { db } from "@/lib/db";
import type { Channel, NotificationMeta, SendResult } from "../types";

const API_BASE = "https://discord.com/api/v10";
const EMBED_COLOR = 0x16a34a; // matches the green-600 used in the UI

function botToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("Discord is not configured: missing DISCORD_BOT_TOKEN");
  }
  return token;
}

function botHeaders(): HeadersInit {
  return {
    Authorization: `Bot ${botToken()}`,
    "Content-Type": "application/json",
  };
}

// Discord-specific failure modes that mean "this user can no longer be
// messaged via the bot" — drop the subscription in those cases.
//   50007: Cannot send messages to this user (DMs disabled / blocked / not
//          in any mutual server with the bot)
//   10003: Unknown channel (cached dmChannelId stale — caller should retry
//          with a fresh channel before treating as gone)
//   10013: Unknown user
function isPermanentlyGone(code: number): boolean {
  return code === 50007 || code === 10013;
}

function isStaleDmChannel(code: number): boolean {
  return code === 10003;
}

// Open a DM channel with a user. Discord caches per-user, so calling this
// repeatedly with the same recipient returns the same channel — but we
// still cache the id ourselves to skip the round-trip on subsequent sends.
async function openDmChannel(discordUserId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/users/@me/channels`, {
      method: "POST",
      headers: botHeaders(),
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(
        "[discord] openDmChannel failed:",
        res.status,
        data?.code,
        data?.message
      );
      return null;
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  } catch (err) {
    console.error("[discord] openDmChannel threw:", err);
    return null;
  }
}

type SendOutcome = "delivered" | "gone" | "stale-channel" | "failed";

async function postMessage(
  channelId: string,
  meta: NotificationMeta
): Promise<SendOutcome> {
  // Use an embed for nicer rendering. Falls back gracefully on Discord
  // clients that don't fully render embeds.
  const body = {
    content: meta.title,
    embeds: [
      {
        description: meta.body,
        color: EMBED_COLOR,
        ...(meta.link ? { url: meta.link } : {}),
        ...(meta.link ? { title: "Open in Crazy Hikers" } : {}),
      },
    ],
  };

  try {
    const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: botHeaders(),
      body: JSON.stringify(body),
    });
    if (res.ok) return "delivered";

    const data = await res.json().catch(() => ({}));
    const code: number = data?.code ?? 0;
    if (isPermanentlyGone(code)) return "gone";
    if (isStaleDmChannel(code)) return "stale-channel";

    console.error(
      "[discord] postMessage failed:",
      res.status,
      code,
      data?.message
    );
    return "failed";
  } catch (err) {
    console.error("[discord] postMessage threw:", err);
    return "failed";
  }
}

// Post a meta as a public announcement in a guild channel (not a DM). The
// bot must already be in the guild with permission to send messages in
// the target channel. No-ops if DISCORD_ANNOUNCEMENTS_CHANNEL_ID is unset,
// so previews/dev environments without the env var stay silent.
//
// This is conceptually different from Channel.send() — that fans out to
// per-user DMs respecting prefs; this posts once to a shared channel
// regardless of who's subscribed. Failures are logged but never surfaced
// (the per-user broadcast already covers the user-facing notification).
export async function announceToDiscordChannel(
  meta: NotificationMeta
): Promise<void> {
  const channelId = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  if (!channelId || !process.env.DISCORD_BOT_TOKEN) return;

  const outcome = await postMessage(channelId, meta);
  if (outcome !== "delivered") {
    console.error(
      "[discord] channel announcement outcome:",
      outcome,
      "channel:",
      channelId
    );
  }
}

// Verify a Discord user is a member of the configured guild. Required
// before saving a subscription — without guild membership the bot can't
// DM them, so the link would silently fail at first send. Bot auth, no
// extra OAuth scope needed on the user side.
export async function isMemberOfGuild(
  discordUserId: string
): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return true; // no gating configured

  try {
    const res = await fetch(
      `${API_BASE}/guilds/${guildId}/members/${discordUserId}`,
      { headers: botHeaders() }
    );
    return res.ok; // 404 = not a member
  } catch (err) {
    console.error("[discord] guild membership check failed:", err);
    return false;
  }
}

export const discordChannel: Channel = {
  id: "discord",
  async send(userEmail, meta): Promise<SendResult> {
    if (!process.env.DISCORD_BOT_TOKEN) {
      return { channel: "discord", attempted: 0, delivered: 0, removed: 0 };
    }

    const sub = await db.discordSubscription.findUnique({
      where: { userEmail },
    });
    if (!sub) {
      return { channel: "discord", attempted: 0, delivered: 0, removed: 0 };
    }

    // Use the cached DM channel if we have one; lazy-open and cache otherwise.
    let channelId = sub.dmChannelId;
    if (!channelId) {
      channelId = await openDmChannel(sub.discordUserId);
      if (!channelId) {
        return { channel: "discord", attempted: 1, delivered: 0, removed: 0 };
      }
      await db.discordSubscription
        .update({ where: { userEmail }, data: { dmChannelId: channelId } })
        .catch(() => {});
    }

    let outcome = await postMessage(channelId, meta);

    // Cached channel went stale — re-open once and retry. Common after
    // long-idle gaps or if Discord rotates channel ids.
    if (outcome === "stale-channel") {
      const fresh = await openDmChannel(sub.discordUserId);
      if (fresh) {
        await db.discordSubscription
          .update({ where: { userEmail }, data: { dmChannelId: fresh } })
          .catch(() => {});
        outcome = await postMessage(fresh, meta);
      } else {
        outcome = "failed";
      }
    }

    if (outcome === "gone") {
      // Bot was blocked or user left the server — drop the row.
      await db.discordSubscription
        .delete({ where: { userEmail } })
        .catch(() => {});
      return { channel: "discord", attempted: 1, delivered: 0, removed: 1 };
    }

    return {
      channel: "discord",
      attempted: 1,
      delivered: outcome === "delivered" ? 1 : 0,
      removed: 0,
    };
  },
};
