import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { findSameDayCommitment } from "@/lib/activity";
import { cacheTags } from "@/lib/cache-tags";
import {
  broadcast,
  notify,
  activityCreatedDispatch,
  comanagerResponseDispatch,
} from "@/lib/notify";

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

  // Block accept when the invitee already has a confirmed commitment
  // (member registration or another confirmed management role) on the
  // same day. Decline is always allowed.
  if (accepted) {
    const conflict = await findSameDayCommitment(am.userEmail, new Date(am.activity.date), am.activityId);
    if (conflict) {
      const label = conflict.role === "manager"
        ? `You are already managing "${conflict.title}" on the same day.`
        : `You are already confirmed for "${conflict.title}" on the same day.`;
      return NextResponse.json({ error: label }, { status: 400 });
    }
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

  // Notify the main manager who issued the invitation, both on accept and
  // decline — they need to know either way (decline means re-invite). Look
  // up the responder's display name for the push body.
  const responder = await db.user.findUnique({
    where: { email: am.userEmail },
    select: { name: true },
  });
  const mainManager = await db.activityManager.findFirst({
    where: {
      activityId: am.activityId,
      role: "manager",
      status: "confirmed",
    },
    select: { userEmail: true },
  });
  if (mainManager) {
    const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
    const dispatch = comanagerResponseDispatch({
      activityId: am.activityId,
      activityTitle: am.activity.title,
      responderName: responder?.name || am.userEmail,
      accepted,
      url: `${baseUrl}/dashboard/activities/${am.activityId}`,
    });
    const recipient = mainManager.userEmail;
    after(async () => {
      try {
        await notify(recipient, dispatch);
      } catch (err) {
        console.error("[notify] comanager_response failed:", err);
      }
    });
  }

  // Accept changes the list of confirmed managers shown on the activity
  // page and the landing page's intern-visibility rule; decline never
  // appears on member-facing pages, so no invalidation needed.
  if (accepted) {
    revalidateTag(cacheTags.activity(am.activityId), "max");
    revalidateTag(cacheTags.activities, "max");

    // Broadcast "activity created" iff this acceptance just transitioned the
    // activity from 0 → 1 confirmed non-intern manager (any role). That
    // captures the spec: an intern-created activity is "created" only once
    // a non-intern co-manager accepts. Counting non-intern confirmed
    // managers also self-prevents double-fire — when a non-intern creator
    // launched the activity, the count was already 1 at creation, and any
    // later acceptances see count > 1.
    const accepterProfile = await db.managerProfile.findUnique({
      where: { userEmail: am.userEmail },
    });
    const accepterIsNonIntern = accepterProfile?.intern === false;

    if (accepterIsNonIntern) {
      const nonInternConfirmedCount = await db.activityManager.count({
        where: {
          activityId: am.activityId,
          status: "confirmed",
          user: { managerProfile: { intern: false } },
        },
      });
      if (nonInternConfirmedCount === 1) {
        const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
        const dispatch = activityCreatedDispatch({
          activityId: am.activityId,
          activityTitle: am.activity.title,
          url: `${baseUrl}/activities/${am.activityId}`,
        });
        after(async () => {
          try {
            await broadcast(dispatch);
          } catch (err) {
            console.error("[notify] activity_created broadcast failed:", err);
          }
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    status: accepted ? "confirmed" : "declined",
  });
}
