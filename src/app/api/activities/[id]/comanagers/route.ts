import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { sendComanagerInvitation } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "activities.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: activityId } = await params;
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Validate activity exists and is still open
  const activity = await db.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }
  if (activity.status !== "open") {
    return NextResponse.json(
      { error: "Cannot invite co-managers for completed or cancelled activities" },
      { status: 400 }
    );
  }

  // Validate target is a manager/admin/dev
  const target = await db.user.findUnique({ where: { email } });
  if (!target || !["manager", "admin", "dev"].includes(target.role)) {
    return NextResponse.json(
      { error: "User is not a manager" },
      { status: 400 }
    );
  }

  // Check not already on this activity
  const existing = await db.activityManager.findUnique({
    where: { activityId_userEmail: { activityId, userEmail: email } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already a manager for this activity" },
      { status: 400 }
    );
  }

  // Create invitation
  const token = randomUUID();
  await db.activityManager.create({
    data: {
      activityId,
      userEmail: email,
      role: "comanager",
      status: "invited",
      token,
    },
  });

  // Send invitation email
  const baseUrl = getBaseUrl();
  const inviteUrl = `${baseUrl}/invitations/comanager/${token}`;
  await sendComanagerInvitation(
    email,
    target.name,
    activity.title,
    inviteUrl
  ).catch((err) => console.error("[EMAIL] Comanager invite failed:", err));

  return NextResponse.json({ success: true });
}
