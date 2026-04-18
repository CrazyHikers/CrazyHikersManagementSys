import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { getFlagSettings, unexpiredCutoff } from "@/lib/flags";
import { deleteFile, getKeyFromUrl } from "@/lib/r2";
import { cacheTags } from "@/lib/cache-tags";
import type { Prisma } from "@/generated/prisma/client";

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

        // Clean up QR code URL from metadata
        const meta = (activity.metadata as Record<string, unknown> | null) ?? {};
        const qrCodeUrl = meta.qrCodeUrl;
        const { qrCodeUrl: _, ...cleanedMetadata } = meta;

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
            data: { status: "completed", metadata: cleanedMetadata as Prisma.InputJsonValue },
          }),
        ]);

        // Delete QR code file from R2
        if (typeof qrCodeUrl === "string") {
          const key = getKeyFromUrl(qrCodeUrl);
          if (key) await deleteFile(key).catch(() => {});
        }
      } else if (body.status === "cancelled") {
        // Clean up QR code URL from metadata
        const meta = (activity.metadata as Record<string, unknown> | null) ?? {};
        const qrCodeUrl = meta.qrCodeUrl;
        const { qrCodeUrl: _, ...cleanedMetadata } = meta;

        await db.$transaction([
          db.registration.deleteMany({ where: { activityId: id } }),
          // Invalidate pending comanager invitation tokens
          db.activityManager.updateMany({
            where: { activityId: id, status: "invited" },
            data: { token: null },
          }),
          db.activity.update({
            where: { id },
            data: { status: "cancelled", metadata: cleanedMetadata as Prisma.InputJsonValue },
          }),
        ]);

        // Delete QR code file from R2
        if (typeof qrCodeUrl === "string") {
          const key = getKeyFromUrl(qrCodeUrl);
          if (key) await deleteFile(key).catch(() => {});
        }
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
        // Fetch current activity to compare old images
        const current = await db.activity.findUnique({ where: { id } });

        await db.activity.update({
          where: { id },
          data: updateData,
        });

        // Clean up replaced images from R2
        if (current) {
          // Cover image changed
          if (body.coverImgId && current.coverImgId && body.coverImgId !== current.coverImgId) {
            await deleteFile(current.coverImgId).catch(() => {});
          }
          // QR code changed
          const oldQr = (current.metadata as Record<string, unknown> | null)?.qrCodeUrl;
          const newQr = (body.metadata as Record<string, unknown> | null)?.qrCodeUrl;
          if (typeof oldQr === "string" && typeof newQr === "string" && oldQr !== newQr) {
            const key = getKeyFromUrl(oldQr);
            if (key) await deleteFile(key).catch(() => {});
          }
        }
      }
    }

    revalidateTag(cacheTags.activity(id));
    revalidateTag(cacheTags.activities);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
