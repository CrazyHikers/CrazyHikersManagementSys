import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-utils";
import { getSetting } from "@/lib/settings";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(session, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email: userEmail } = await params;
  const decodedEmail = decodeURIComponent(userEmail);
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

  const issuedByEmail = session.user.email || "unknown";

  const flagExpiryDays = await getSetting("flag_expiry_days");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + flagExpiryDays);

  let effectiveFlagType = flagType as "yellow" | "red";

  // Check if this yellow flag should auto-escalate to red
  if (flagType === "yellow") {
    const threshold = await getSetting("yellow_to_red_threshold");
    const activeYellowCount = await db.userFlag.count({
      where: {
        userEmail: decodedEmail,
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
  await db.userFlag.create({
    data: {
      userEmail: decodedEmail,
      activityId,
      flagType: effectiveFlagType,
      reason: reason || null,
      banUntil,
      expiresAt,
      issuedBy: issuedByEmail,
    },
  });

  // No need to update registrations -- shadow ban is checked at query time
  // when managers view the registrations list

  return NextResponse.json({
    success: true,
    effectiveFlagType,
    escalated: effectiveFlagType !== flagType,
    banUntil: banUntil.toISOString(),
  });
}

// GET: Retrieve flag history for a user (manager-only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(session, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email: userEmail } = await params;
  const decodedEmail = decodeURIComponent(userEmail);
  const flags = await db.userFlag.findMany({
    where: {
      userEmail: decodedEmail,
      expiresAt: { gt: new Date() }, // only active (non-expired) flags
    },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json(flags);
}
