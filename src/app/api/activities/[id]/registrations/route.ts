import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendRegistrationConfirmation } from "@/lib/email";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const registrations = await db.registration.findMany({
    where: { activityId: id },
    include: { member: true },
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

  const { id: activityId } = await params;
  const { memberId, status } = await request.json();

  if (!memberId || !status) {
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
            activityId_memberId: { activityId, memberId },
          },
          data: { status: "registration_confirmed", confirmedAt: new Date() },
        }),
        // Remove same-day pending registrations
        ...(activity
          ? [
              db.registration.deleteMany({
                where: {
                  memberId,
                  status: "registered",
                  activityId: { not: activityId },
                  activity: { date: activity.date },
                },
              }),
            ]
          : []),
      ]);

      // Send confirmation email
      const member = await db.member.findUnique({ where: { id: memberId } });
      if (member && activity) {
        await sendRegistrationConfirmation(
          member.email,
          member.name,
          activity.title
        ).catch(console.error);
      }
    } else {
      await db.registration.update({
        where: {
          activityId_memberId: { activityId, memberId },
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

  const { id: activityId } = await params;
  const { memberId } = await request.json();

  await db.registration.delete({
    where: {
      activityId_memberId: { activityId, memberId },
    },
  });

  return NextResponse.json({ success: true });
}
