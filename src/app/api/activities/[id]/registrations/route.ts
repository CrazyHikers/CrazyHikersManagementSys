import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can, canApproveRegistrations } from "@/lib/permissions";
import { findSameDayCommitment } from "@/lib/activity";
import { cacheTags } from "@/lib/cache-tags";
import { notify, registrationConfirmedDispatch } from "@/lib/notify";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "registrations.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const registrations = await db.registration.findMany({
    where: { activityId: id },
    include: { user: true },
    orderBy: { registeredAt: "asc" },
  });

  return NextResponse.json(registrations);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "registrations.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: activityId } = await params;
  const body = await request.json();

  // Batch attendance updates — used by the debounced auto-save. Only
  // `attended` / `absent` transitions are allowed in batch mode, so this
  // path skips capacity checks and confirmation emails.
  if (Array.isArray(body.updates)) {
    const updates = (body.updates as { userEmail?: string; status?: string }[])
      .filter(
        (u): u is { userEmail: string; status: "attended" | "absent" } =>
          !!u.userEmail && (u.status === "attended" || u.status === "absent")
      );
    if (updates.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }
    try {
      await db.$transaction(
        updates.map((u) =>
          db.registration.update({
            where: { activityId_userEmail: { activityId, userEmail: u.userEmail } },
            data: { status: u.status },
          })
        )
      );
      revalidateTag(cacheTags.activity(activityId), "max");
      revalidateTag(cacheTags.activities, "max");
      return NextResponse.json({ success: true, updated: updates.length });
    } catch (error) {
      console.error("Batch registration update error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  const { userEmail, status } = body;

  if (!userEmail || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    if (status === "registration_confirmed") {
      // Approving a member into the activity is reserved for non-intern
      // managers. Even if an intern is the main manager of this activity,
      // a qualified co-manager must perform the confirm.
      if (!canApproveRegistrations(session)) {
        return NextResponse.json(
          { error: "Intern managers cannot approve registrations" },
          { status: 403 }
        );
      }

      // Confirm registration and cancel conflicting same-day registrations
      const activity = await db.activity.findUnique({
        where: { id: activityId },
      });

      // Check capacity before confirming
      if (activity && activity.capacity > 0) {
        const confirmedCount = await db.registration.count({
          where: {
            activityId,
            status: { in: ["registration_confirmed", "attended"] },
          },
        });
        if (confirmedCount >= activity.capacity) {
          return NextResponse.json(
            { error: "Activity has reached maximum capacity" },
            { status: 409 }
          );
        }
      }

      // Block if the member already has a confirmed commitment (as member
      // or as a confirmed manager/comanager) for another activity on the
      // same day.
      if (activity) {
        const conflict = await findSameDayCommitment(userEmail, new Date(activity.date), activityId);
        if (conflict) {
          const label = conflict.role === "manager"
            ? `This member is already managing "${conflict.title}" on the same day`
            : `This member is already confirmed for "${conflict.title}" on the same day`;
          return NextResponse.json({ error: label }, { status: 409 });
        }
      }

      await db.registration.update({
        where: {
          activityId_userEmail: { activityId, userEmail },
        },
        data: { status: "registration_confirmed", confirmedAt: new Date() },
      });

      // Fire push notification to whatever channels the user has enabled.
      // `after()` keeps the function alive past the response; a bare
      // unawaited promise would risk being killed by Vercel before the
      // push completes. A delivery failure must not roll back the confirm.
      if (activity) {
        const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
        const dispatch = registrationConfirmedDispatch({
          activityId,
          activityTitle: activity.title,
          url: `${baseUrl}/activities/${activityId}`,
        });
        after(async () => {
          try {
            await notify(userEmail, dispatch);
          } catch (err) {
            console.error("[notify] registration_confirmed failed:", err);
          }
        });
      }
    } else {
      await db.registration.update({
        where: {
          activityId_userEmail: { activityId, userEmail },
        },
        data: { status },
      });
    }

    revalidateTag(cacheTags.activity(activityId), "max");
    revalidateTag(cacheTags.activities, "max");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "registrations.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: activityId } = await params;
  const body = await request.json();

  // Bulk remove all unconfirmed (status="registered") registrations
  if (body.all === "unconfirmed") {
    const result = await db.registration.deleteMany({
      where: { activityId, status: "registered" },
    });
    revalidateTag(cacheTags.activity(activityId), "max");
    revalidateTag(cacheTags.activities, "max");
    return NextResponse.json({ success: true, removed: result.count });
  }

  // Single removal
  const { userEmail } = body;
  if (!userEmail) {
    return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });
  }

  await db.registration.delete({
    where: {
      activityId_userEmail: { activityId, userEmail },
    },
  });

  revalidateTag(cacheTags.activity(activityId), "max");
  revalidateTag(cacheTags.activities, "max");
  return NextResponse.json({ success: true });
}
