import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  resolvePrefs,
  USER_TOGGLEABLE_KINDS,
  type NotificationPreferences,
  type UserToggleableKind,
} from "@/lib/notify";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { notificationPrefs: true },
  });
  return NextResponse.json(resolvePrefs(user?.notificationPrefs));
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Whitelist incoming keys to known kinds + booleans, ignore anything else.
  const incoming: NotificationPreferences = {};
  for (const k of USER_TOGGLEABLE_KINDS) {
    const v = body[k as UserToggleableKind];
    if (typeof v === "boolean") incoming[k as UserToggleableKind] = v;
  }

  const existing = await db.user.findUnique({
    where: { email: session.user.email },
    select: { notificationPrefs: true },
  });
  const merged: NotificationPreferences = {
    ...resolvePrefs(existing?.notificationPrefs),
    ...incoming,
  };

  await db.user.update({
    where: { email: session.user.email },
    data: { notificationPrefs: merged },
  });

  return NextResponse.json(resolvePrefs(merged));
}
