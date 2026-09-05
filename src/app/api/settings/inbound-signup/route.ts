import crypto from "crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getInboundSignupConfig,
  INBOUND_SIGNUP_SETTING_KEYS,
  closeInboundSignupSession,
  openInboundSignupSession,
} from "@/lib/inbound-signup";

async function isDev() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "dev";
}

export async function GET() {
  if (!(await isDev())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getInboundSignupConfig();
  return NextResponse.json({
    enabled: config.enabled,
    active: config.active,
    configured: config.configured,
    address: config.address,
    expiresAt: config.expiresAt?.toISOString() || null,
  });
}

export async function PUT(request: Request) {
  if (!(await isDev())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!body.enabled) {
    const current = await getInboundSignupConfig();
    await db.appSettings.upsert({
      where: { key: INBOUND_SIGNUP_SETTING_KEYS.enabled },
      update: { value: "0" },
      create: { key: INBOUND_SIGNUP_SETTING_KEYS.enabled, value: "0" },
    });
    revalidateTag("app-settings", { expire: 0 });
    if (current.generation && process.env.INBOUND_SIGNUP_WORKER_URL) {
      try {
        await closeInboundSignupSession(current.generation);
      } catch (error) {
        console.error("[INBOUND_SIGNUP] failed to close Worker session", error);
        return NextResponse.json(
          { error: "Signup mode was disabled, but the Worker session could not be cleared. Please retry." },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ success: true });
  }

  const expiresAt = typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return NextResponse.json({ error: "Expiry must be in the future." }, { status: 400 });
  }
  if (
    !process.env.INBOUND_SIGNUP_ADDRESS ||
    !process.env.INBOUND_SIGNUP_WEBHOOK_SECRET ||
    !process.env.INBOUND_SIGNUP_WORKER_URL
  ) {
    return NextResponse.json(
      { error: "Inbound signup environment variables are not configured." },
      { status: 503 },
    );
  }

  const generation = crypto.randomBytes(16).toString("hex");
  try {
    await openInboundSignupSession(generation, expiresAt);
  } catch (error) {
    console.error("[INBOUND_SIGNUP] failed to open Worker session", error);
    return NextResponse.json({ error: "Could not start the Worker signup session." }, { status: 503 });
  }

  try {
    await db.$transaction([
      db.appSettings.upsert({
        where: { key: INBOUND_SIGNUP_SETTING_KEYS.enabled },
        update: { value: "1" },
        create: { key: INBOUND_SIGNUP_SETTING_KEYS.enabled, value: "1" },
      }),
      db.appSettings.upsert({
        where: { key: INBOUND_SIGNUP_SETTING_KEYS.expiresAt },
        update: { value: expiresAt.toISOString() },
        create: { key: INBOUND_SIGNUP_SETTING_KEYS.expiresAt, value: expiresAt.toISOString() },
      }),
      db.appSettings.upsert({
        where: { key: INBOUND_SIGNUP_SETTING_KEYS.generation },
        update: { value: generation },
        create: { key: INBOUND_SIGNUP_SETTING_KEYS.generation, value: generation },
      }),
    ]);
  } catch (error) {
    await closeInboundSignupSession(generation).catch(() => undefined);
    throw error;
  }
  revalidateTag("app-settings", { expire: 0 });
  return NextResponse.json({ success: true });
}
