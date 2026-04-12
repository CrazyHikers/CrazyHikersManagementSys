import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { getFlagSettings, unexpiredCutoff } from "@/lib/flags";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: { include: { user: true } },
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["registration_confirmed", "attended"] } },
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
  if (!can(session, "activities.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
        // Require at least one confirmed/attended member to finish
        const confirmedCount = await db.registration.count({
          where: {
            activityId: id,
            status: { in: ["registration_confirmed", "attended"] },
          },
        });
        if (confirmedCount === 0) {
          return NextResponse.json(
            { error: "Cannot finish activity without confirmed members" },
            { status: 400 }
          );
        }

        // Finalize pending flags before completion
        const flaggedRegistrations = await db.registration.findMany({
          where: {
            activityId: id,
            pendingFlag: { not: null },
            status: { in: ["registration_confirmed", "attended"] },
          },
        });

        if (flaggedRegistrations.length > 0) {
          const [flagSettings, yellowThreshold] = await Promise.all([
            getFlagSettings(),
            getSetting("yellow_to_red_threshold"),
          ]);

          const issuedByEmail = session.user.email || "unknown";
          const now = new Date();

          for (const reg of flaggedRegistrations) {
            let effectiveFlagType = reg.pendingFlag as "yellow" | "red";

            // Auto-escalation: check if yellow flags should become red
            if (effectiveFlagType === "yellow") {
              const activeYellowCount = await db.userFlag.count({
                where: {
                  userEmail: reg.userEmail,
                  flagType: "yellow",
                  invalidated: false,
                  issuedAt: { gt: unexpiredCutoff(flagSettings, now) },
                },
              });
              if (activeYellowCount + 1 >= yellowThreshold) {
                effectiveFlagType = "red";
              }
            }

            await db.userFlag.create({
              data: {
                userEmail: reg.userEmail,
                activityId: id,
                flagType: effectiveFlagType,
                reason: reg.pendingFlagReason || null,
                issuedBy: issuedByEmail,
              },
            });
          }
        }

        // Mark unconfirmed registrations as absent, remove pending
        await db.$transaction([
          db.registration.updateMany({
            where: { activityId: id, status: "registration_confirmed" },
            data: { status: "absent" },
          }),
          db.registration.deleteMany({
            where: { activityId: id, status: "registered" },
          }),
          db.activityManager.updateMany({
            where: { activityId: id, status: "invited" },
            data: { token: null },
          }),
          db.activity.update({
            where: { id },
            data: { status: "completed" },
          }),
        ]);
      } else if (body.status === "cancelled") {
        await db.$transaction([
          db.registration.deleteMany({ where: { activityId: id } }),
          // Invalidate pending comanager invitation tokens
          db.activityManager.updateMany({
            where: { activityId: id, status: "invited" },
            data: { token: null },
          }),
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
        "metadata",
      ];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
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
