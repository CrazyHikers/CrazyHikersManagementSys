import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { DEFAULTS } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user || !can(session, "settings.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stored = await db.appSettings.findMany();
  const storedMap = new Map(stored.map((s) => [s.key, s.value]));

  // Merge defaults with stored values so all settings always appear
  const settings = Object.entries(DEFAULTS).map(([key, defaultValue]) => ({
    id: key,
    key,
    value: storedMap.get(key) ?? String(defaultValue),
  }));

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !can(session, "settings.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { settings } = await request.json();

  if (!Array.isArray(settings)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  for (const setting of settings) {
    await db.appSettings.upsert({
      where: { key: setting.key },
      update: { value: String(setting.value) },
      create: { key: setting.key, value: String(setting.value) },
    });
  }

  return NextResponse.json({ success: true });
}
