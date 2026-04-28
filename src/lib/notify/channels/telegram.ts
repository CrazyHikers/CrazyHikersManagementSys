import { db } from "@/lib/db";
import type { Channel, NotificationMeta, SendResult } from "../types";

const API_BASE = "https://api.telegram.org";

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram is not configured: missing TELEGRAM_BOT_TOKEN");
  }
  return token;
}

// Telegram MarkdownV2 reserves a long list of characters that must be
// backslash-escaped or the message is rejected. Easier to send plain text
// and skip Markdown entirely — we don't currently need bold/italics.
type SendMessageResult = "delivered" | "gone" | "failed";

function isGone(status: number, description: string): boolean {
  // 403 "Forbidden: bot was blocked by the user" or "user is deactivated"
  // 400 "chat not found" — chatId is stale
  if (status === 403) return true;
  if (status === 400 && /chat not found/i.test(description)) return true;
  return false;
}

async function sendToChat(
  chatId: string,
  meta: NotificationMeta
): Promise<SendMessageResult> {
  const text = meta.link
    ? `${meta.title}\n\n${meta.body}\n\n${meta.link}`
    : `${meta.title}\n\n${meta.body}`;

  try {
    const res = await fetch(`${API_BASE}/bot${botToken()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // Don't auto-preview the link — the body already mentions context.
        link_preview_options: { is_disabled: true },
      }),
    });

    if (res.ok) return "delivered";

    const data = await res.json().catch(() => ({}));
    const description = (data && data.description) || "";
    if (isGone(res.status, description)) return "gone";

    console.error(
      "[telegram] sendMessage failed:",
      res.status,
      description || (await res.text().catch(() => ""))
    );
    return "failed";
  } catch (err) {
    console.error("[telegram] sendMessage threw:", err);
    return "failed";
  }
}

export const telegramChannel: Channel = {
  id: "telegram",
  async send(userEmail, meta): Promise<SendResult> {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      // Channel not configured — silently skip rather than throw, so a
      // missing env var doesn't bring down all notifications.
      return { channel: "telegram", attempted: 0, delivered: 0, removed: 0 };
    }

    const sub = await db.telegramSubscription.findUnique({
      where: { userEmail },
    });
    if (!sub) {
      return { channel: "telegram", attempted: 0, delivered: 0, removed: 0 };
    }

    const result = await sendToChat(sub.chatId, meta);

    if (result === "gone") {
      // Bot was blocked or chat is gone — drop the row, the user has
      // effectively unsubscribed.
      await db.telegramSubscription
        .delete({ where: { userEmail } })
        .catch(() => {});
      return { channel: "telegram", attempted: 1, delivered: 0, removed: 1 };
    }

    return {
      channel: "telegram",
      attempted: 1,
      delivered: result === "delivered" ? 1 : 0,
      removed: 0,
    };
  },
};

// Send a plain message to a specific chat. Used by the webhook to confirm a
// successful link without going through the channel/dispatch path.
export async function sendTelegramRawMessage(
  chatId: string,
  text: string
): Promise<void> {
  await fetch(`${API_BASE}/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((err) => console.error("[telegram] raw send failed:", err));
}
