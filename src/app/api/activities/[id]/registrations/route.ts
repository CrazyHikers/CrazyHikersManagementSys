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
  const { userEmail, status } = await request.json();

  if (!userEmail || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    if (status === "registration_confirmed") {
      // Confirm registration and cancel conflicting same-day registrations
      const activity = await db.activity.findUnique({
        where: { id: activityId },
      });

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
  const { userEmail } = await request.json();

  await db.registration.delete({
    where: {
      activityId_userEmail: { activityId, userEmail },
    },
  });

  return NextResponse.json({ success: true });
}
