import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWaiverExpiryNotification } from "@/lib/email";

const WAIVER_VALIDITY_DAYS = 365;

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 1. Mark expired waivers
    const expiredCutoff = new Date(now);
    expiredCutoff.setDate(expiredCutoff.getDate() - WAIVER_VALIDITY_DAYS);

    await db.userWaiver.updateMany({
      where: {
        signedAt: { lt: expiredCutoff },
        status: "approved",
      },
      data: { status: "expired" },
    });

    // 2. Notify users with waivers expiring in 7 days
    const expiringCutoff = new Date(now);
    expiringCutoff.setDate(expiringCutoff.getDate() + 7);
    const notifyCutoff = new Date(expiringCutoff);
    notifyCutoff.setDate(notifyCutoff.getDate() - WAIVER_VALIDITY_DAYS);

    const expiringWaivers = await db.userWaiver.findMany({
      where: {
        signedAt: {
          gte: new Date(
            notifyCutoff.getFullYear(),
            notifyCutoff.getMonth(),
            notifyCutoff.getDate()
          ),
          lt: new Date(
            notifyCutoff.getFullYear(),
            notifyCutoff.getMonth(),
            notifyCutoff.getDate() + 1
          ),
        },
        status: "approved",
      },
      include: { user: true },
    });

    // Send notifications
    const waiverFormUrl = `${process.env.AUTH_URL}/waiver/submit`;
    for (const waiver of expiringWaivers) {
      await sendWaiverExpiryNotification(
        waiver.user.email,
        waiver.user.name,
        waiverFormUrl
      ).catch(console.error);
    }

    // Mark as expiring
    if (expiringWaivers.length > 0) {
      await db.userWaiver.updateMany({
        where: {
          fileId: { in: expiringWaivers.map((w) => w.fileId) },
        },
        data: { status: "expiring" },
      });
    }

    return NextResponse.json({
      expired: "done",
      notified: expiringWaivers.length,
    });
  } catch (error) {
    console.error("Cron waiver check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
