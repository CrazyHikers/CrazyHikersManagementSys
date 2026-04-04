import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Default durations in days
const DEFAULTS = {
  ban_duration_yellow: 7,
  ban_duration_red: 30,
  flag_expiry_days: 180, // 6 months - how long a flag stays on record
  yellow_to_red_threshold: 3, // 3 active yellow flags → auto red
};

async function getSetting(key: string): Promise<number> {
  const setting = await db.appSettings.findUnique({ where: { key } });
  if (setting) return parseInt(setting.value, 10);
  return DEFAULTS[key as keyof typeof DEFAULTS] ?? 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;
  const { flagType, activityId, reason } = await request.json();

  if (!flagType || !["yellow", "red"].includes(flagType)) {
    return NextResponse.json({ error: "Invalid flag type" }, { status: 400 });
  }

  if (!activityId) {
    return NextResponse.json(
      { error: "Activity ID required" },
      { status: 400 }
    );
  }

  const managerId =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((session.user as any).managerId as string) || "unknown";

  const flagExpiryDays = await getSetting("flag_expiry_days");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + flagExpiryDays);

  let effectiveFlagType = flagType as "yellow" | "red";

  // Check if this yellow flag should auto-escalate to red
  if (flagType === "yellow") {
    const threshold = await getSetting("yellow_to_red_threshold");
    const activeYellowCount = await db.memberFlag.count({
      where: {
        memberId,
        flagType: "yellow",
        expiresAt: { gt: new Date() }, // only count non-expired flags
      },
    });

    // If adding this yellow would reach/exceed threshold, escalate to red
    if (activeYellowCount + 1 >= threshold) {
      effectiveFlagType = "red";
    }
  }

  const banDays = await getSetting(`ban_duration_${effectiveFlagType}`);
  const banUntil = new Date();
  banUntil.setDate(banUntil.getDate() + banDays);

  // Create the flag
  await db.memberFlag.create({
    data: {
      memberId,
      activityId,
      flagType: effectiveFlagType,
      reason: reason || null,
      banUntil,
      expiresAt,
      issuedBy: managerId,
    },
  });

  // No need to update registrations — shadow ban is checked at query time
  // when managers view the registrations list

  return NextResponse.json({
    success: true,
    effectiveFlagType,
    escalated: effectiveFlagType !== flagType,
    banUntil: banUntil.toISOString(),
  });
}

// GET: Retrieve flag history for a member (manager-only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;
  const flags = await db.memberFlag.findMany({
    where: {
      memberId,
      expiresAt: { gt: new Date() }, // only active (non-expired) flags
    },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json(flags);
}
