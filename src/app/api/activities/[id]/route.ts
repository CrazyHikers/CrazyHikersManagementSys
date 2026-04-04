import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: { include: { manager: true } },
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["registered", "registration_confirmed"] } },
          },
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(activity);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    // Handle status transitions with business logic
    if (body.status) {
      const activity = await db.activity.findUnique({ where: { id } });
      if (!activity) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (body.status === "completed") {
        // Mark unconfirmed registrations as absent, remove pending
        await db.$transaction([
          db.registration.updateMany({
            where: { activityId: id, status: "registration_confirmed" },
            data: { status: "absent" },
          }),
          db.registration.deleteMany({
            where: { activityId: id, status: "registered" },
          }),
          // Update manager KPIs
          ...await (async () => {
            const managers = await db.activityManager.findMany({
              where: { activityId: id, status: "confirmed" },
            });
            return managers.map((m) =>
              db.manager.update({
                where: { id: m.managerId },
                data: { kpi: { increment: m.role === "manager" ? 2 : 1 } },
              })
            );
          })(),
          db.activity.update({
            where: { id },
            data: { status: "completed" },
          }),
        ]);
      } else if (body.status === "cancelled") {
        await db.$transaction([
          db.registration.deleteMany({ where: { activityId: id } }),
          db.activity.update({
            where: { id },
            data: { status: "cancelled" },
          }),
        ]);
      } else {
        await db.activity.update({
          where: { id },
          data: { status: body.status },
        });
      }
    } else {
      // General update
      const updateData: Record<string, unknown> = {};
      const allowedFields = [
        "title",
        "description",
        "coverImgId",
        "deadline",
        "date",
        "capacity",
        "maximumRegistration",
      ];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field === "coverImgId" ? "coverImgId" : field] =
            body[field];
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db.activity.update({
          where: { id },
          data: updateData,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
