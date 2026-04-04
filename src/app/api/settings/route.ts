import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasRole(session, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.appSettings.findMany({
    orderBy: { key: "asc" },
  });

  return NextResponse.json(
    settings.map((s) => ({ id: s.key, key: s.key, value: s.value }))
  );
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { settings } = await request.json();

  if (!Array.isArray(settings)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  for (const setting of settings) {
    await db.appSettings.update({
      where: { key: setting.key },
      data: { value: String(setting.value) },
    });
  }

  return NextResponse.json({ success: true });
}
