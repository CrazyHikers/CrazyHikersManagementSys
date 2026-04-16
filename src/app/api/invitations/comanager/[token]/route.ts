import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const am = await db.activityManager.findFirst({
    where: { token },
    include: {
      activity: true,
      user: true,
    },
  });

  if (!am) {
    return NextResponse.json(
      { error: "invalid", message: "Invalid or expired invitation link" },
      { status: 404 }
    );
  }

  if (am.status !== "invited") {
    return NextResponse.json({
      error: "already_responded",
      message: `You have already ${am.status} this invitation`,
      status: am.status,
    });
  }

  if (["completed", "cancelled"].includes(am.activity.status)) {
    return NextResponse.json({
      error: "activity_ended",
      message: "This activity has already been " + am.activity.status,
    });
  }

  // Find the main manager who sent the invitation
  const mainManager = await db.activityManager.findFirst({
    where: { activityId: am.activityId, role: "manager", status: "confirmed" },
    include: { user: true },
  });

  return NextResponse.json({
    activityTitle: am.activity.title,
    activityDate: am.activity.date,
    invitedAs: am.role,
    invitedByName: mainManager?.user.name || "Unknown",
    invitedByEmail: mainManager?.user.email || "",
    yourName: am.user.name,
    yourEmail: am.user.email,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { accepted } = await request.json();

  const am = await db.activityManager.findFirst({
    where: { token },
    include: { activity: true },
  });

  if (!am) {
    return NextResponse.json(
      { error: "Invalid or expired invitation link" },
      { status: 404 }
    );
  }

  if (am.status !== "invited") {
    return NextResponse.json(
      { error: `Already ${am.status}` },
      { status: 400 }
    );
  }

  if (["completed", "cancelled"].includes(am.activity.status)) {
    return NextResponse.json(
      { error: "Activity has already ended" },
      { status: 400 }
    );
  }

  // On accept: auto-withdraw any existing member registration for this
  // activity, since a confirmed co-manager cannot also be a participant.
  await db.$transaction([
    db.activityManager.update({
      where: {
        activityId_userEmail: {
          activityId: am.activityId,
          userEmail: am.userEmail,
        },
      },
      data: {
        status: accepted ? "confirmed" : "declined",
        respondedAt: new Date(),
        token: null,
      },
    }),
    ...(accepted
      ? [
          db.registration.deleteMany({
            where: {
              activityId: am.activityId,
              userEmail: am.userEmail,
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    success: true,
    status: accepted ? "confirmed" : "declined",
  });
}
