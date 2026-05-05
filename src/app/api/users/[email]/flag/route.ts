import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getFlagSettings, unexpiredCutoff } from "@/lib/flags";

// SET a pending flag on a registration (not finalized until activity completion)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "registrations.flag")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email: userEmail } = await params;
  const decodedEmail = decodeURIComponent(userEmail);
  const { flagType, activityId, reason } = await request.json();

  if (!flagType || !["yellow", "red"].includes(flagType)) {
    return NextResponse.json({ error: "Invalid flag type" }, { status: 400 });
  }
  if (!activityId) {
    return NextResponse.json({ error: "Activity ID required" }, { status: 400 });
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  // Verify registration exists and is confirmed, attended, or absent
  const registration = await db.registration.findUnique({
    where: { activityId_userEmail: { activityId, userEmail: decodedEmail } },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  if (!["registration_confirmed", "attended", "absent"].includes(registration.status)) {
    return NextResponse.json(
      { error: "Can only flag users with confirmed, attended, or absent registrations" },
      { status: 400 }
    );
  }

  // Toggle: if same flag type already set, clear it; otherwise set new flag
  const isClearing = registration.pendingFlag === flagType;

  await db.registration.update({
    where: { activityId_userEmail: { activityId, userEmail: decodedEmail } },
    data: {
      pendingFlag: isClearing ? null : flagType,
      pendingFlagReason: isClearing ? null : reason.trim(),
    },
  });

  return NextResponse.json({
    success: true,
    pendingFlag: isClearing ? null : flagType,
    pendingFlagReason: isClearing ? null : reason.trim(),
  });
}

// CLEAR a pending flag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "registrations.flag")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email: userEmail } = await params;
  const decodedEmail = decodeURIComponent(userEmail);
  const { activityId } = await request.json();

  if (!activityId) {
    return NextResponse.json({ error: "Activity ID required" }, { status: 400 });
  }

  await db.registration.update({
    where: { activityId_userEmail: { activityId, userEmail: decodedEmail } },
    data: { pendingFlag: null, pendingFlagReason: null },
  });

  return NextResponse.json({ success: true });
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
  if (!can(session, "registrations.flag")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email: userEmail } = await params;
  const decodedEmail = decodeURIComponent(userEmail);
  const flagSettings = await getFlagSettings();
  const flags = await db.userFlag.findMany({
    where: {
      userEmail: decodedEmail,
      invalidated: false,
      activity: { date: { gt: unexpiredCutoff(flagSettings) } },
    },
    orderBy: { activity: { date: "desc" } },
  });

  return NextResponse.json(flags);
}
