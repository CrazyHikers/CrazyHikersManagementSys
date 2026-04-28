import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegramRawMessage } from "@/lib/notify/channels/telegram";

// Telegram update payloads we care about. The full Update object is huge;
// type only what we read.
type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

// Telegram POSTs every update from the bot here. Auth is via the
// X-Telegram-Bot-Api-Secret-Token header, set when registering the webhook
// with setWebhook?secret_token=<TELEGRAM_WEBHOOK_SECRET>. Without this
// check, anyone could spoof updates and bind arbitrary chats to user
// accounts.
//
// We currently handle only the /start <link-token> command — that's the
// one piece of the linking flow that runs Telegram-side. Everything else
// falls through silently.
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (
    !process.env.TELEGRAM_WEBHOOK_SECRET ||
    secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    // Telegram retries on non-2xx, so we still return 200 to drop the
    // update silently rather than triggering retry storms. The earlier
    // header check is the actual security boundary.
    return NextResponse.json({ ok: true });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  // Only DM chats count for linking. Private = 1:1 DM with the bot.
  if (message.chat.type !== "private") return NextResponse.json({ ok: true });

  // /start <token> — bind this chat to the userEmail in the token row.
  const startMatch = message.text.match(/^\/start(?:\s+([\w-]+))?/);
  if (startMatch) {
    const tokenId = startMatch[1];
    if (!tokenId) {
      await sendTelegramRawMessage(
        String(message.chat.id),
        "Hi! To link your Crazy Hikers account, click the link button on the website's notification settings."
      );
      return NextResponse.json({ ok: true });
    }

    await handleStartCommand(tokenId, message);
    return NextResponse.json({ ok: true });
  }

  // Future: handle /unlink, /help, etc. For now drop unknown commands.
  return NextResponse.json({ ok: true });
}

async function handleStartCommand(
  tokenId: string,
  message: TelegramMessage
): Promise<void> {
  const chatId = String(message.chat.id);
  const username = message.from?.username;

  const token = await db.telegramLinkToken.findUnique({
    where: { id: tokenId },
  });

  const now = new Date();
  if (!token || token.usedAt || token.expiresAt < now) {
    await sendTelegramRawMessage(
      chatId,
      "This link has expired or already been used. Please go back to the Crazy Hikers website and click the link button again to get a new link."
    );
    return;
  }

  // Bind: upsert the subscription, mark the token used. Done as a
  // transaction so a partial failure can't leave inconsistent state.
  try {
    await db.$transaction([
      db.telegramSubscription.upsert({
        where: { userEmail: token.userEmail },
        create: { userEmail: token.userEmail, chatId, username },
        update: { chatId, username },
      }),
      db.telegramLinkToken.update({
        where: { id: tokenId },
        data: { usedAt: now },
      }),
    ]);
  } catch (err) {
    // Most likely cause: chatId is already bound to a different userEmail
    // (chat_id is @unique). Tell the user; they'd need to unlink the other
    // account first.
    console.error("[telegram/webhook] bind failed:", err);
    await sendTelegramRawMessage(
      chatId,
      "Could not link this Telegram account. It may already be linked to a different Crazy Hikers account. Please unlink it first or contact a manager."
    );
    return;
  }

  await sendTelegramRawMessage(
    chatId,
    `✅ Linked to ${token.userEmail}. You'll receive Crazy Hikers notifications here. To stop, unlink on the website or block this bot.`
  );
}
