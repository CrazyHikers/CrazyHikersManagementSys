import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { sendRegistrationConfirmation } from "@/lib/email";

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

      await db.$transaction([
        db.registration.update({
          where: {
            activityId_userEmail: { activityId, userEmail },
          },
          data: { status: "registration_confirmed", confirmedAt: new Date() },
        }),
        // Remove same-day pending registrations
        ...(activity
          ? [
              db.registration.deleteMany({
                where: {
                  userEmail,
                  status: "registered",
                  activityId: { not: activityId },
                  activity: { date: activity.date },
                },
              }),
            ]
          : []),
      ]);

      // Send confirmation email with QR code if available
      const user = await db.user.findUnique({ where: { email: userEmail } });
      if (user && activity) {
        const qrCodeUrl = (activity.metadata as Record<string, unknown> | null)?.qrCodeUrl as string | undefined;
        await sendRegistrationConfirmation(
          user.email,
          user.name,
          activity.title,
          qrCodeUrl
        ).catch(console.error);
      }
    } else {
      await db.registration.update({
        where: {
          activityId_userEmail: { activityId, userEmail },
        },
        data: { status },
      });
    }

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

  return NextResponse.json({ success: true });
}
