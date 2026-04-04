import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPromotionResultEmail } from "@/lib/email";
import { getCurrentSeason } from "@/lib/kpi";
import { getSetting } from "@/lib/settings";

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const { start: seasonStart, end: seasonEnd } = await getCurrentSeason();
    const internMaxSeasons = await getSetting("intern_max_seasons");
    const seasonStartMonth = await getSetting("kpi_season_start_month");
    const monthIndex = seasonStartMonth - 1;

    // 1. Find qualified managers who did NOT main-manage any completed activity in the past season
    const qualifiedManagers = await db.managerProfile.findMany({
      where: { intern: false },
      include: { user: true },
    });

    let demotedToIntern = 0;
    for (const mp of qualifiedManagers) {
      const managedInSeason = await db.activityManager.count({
        where: {
          userEmail: mp.userEmail,
          role: "manager",
          status: "confirmed",
          activity: {
            status: "completed",
            date: { gte: seasonStart, lt: seasonEnd },
          },
        },
      });

      if (managedInSeason === 0) {
        // Demote to intern
        await db.managerProfile.update({
          where: { userEmail: mp.userEmail },
          data: { intern: true, internSince: new Date() },
        });
        demotedToIntern++;
        console.log(
          `KPI check: demoted ${mp.userEmail} to intern (no managed activities in season)`
        );
        // Send notification email
        await sendPromotionResultEmail(
          mp.userEmail,
          mp.user.name,
          false,
          "",
          [
            "You have been moved to intern status because you did not main-manage any activity in the past hiking season.",
          ]
        );
      }
    }

    // 2. Find intern managers whose internSince is > internMaxSeasons seasons ago
    const twoSeasonsAgo = new Date(now.getFullYear() - internMaxSeasons, monthIndex, 1);
    const overdueInterns = await db.managerProfile.findMany({
      where: {
        intern: true,
        internSince: { lt: twoSeasonsAgo },
      },
      include: { user: true },
    });

    let removedManagers = 0;
    for (const mp of overdueInterns) {
      // Check if they have an approved intern_to_qualified promotion
      const hasPromotion = await db.promotionRequest.findFirst({
        where: {
          userEmail: mp.userEmail,
          type: "intern_to_qualified",
          status: "approved",
        },
      });

      if (!hasPromotion) {
        // Remove manager status
        await db.managerProfile.delete({
          where: { userEmail: mp.userEmail },
        });
        await db.user.update({
          where: { email: mp.userEmail },
          data: { role: "member" },
        });
        removedManagers++;
        console.log(
          `KPI check: removed manager status for ${mp.userEmail} (intern for >2 seasons without qualifying)`
        );
        // Send notification email
        await sendPromotionResultEmail(
          mp.userEmail,
          mp.user.name,
          false,
          "",
          [
            `Your manager status has been removed because your intern period exceeded ${internMaxSeasons} hiking seasons without qualifying.`,
          ]
        );
      }
    }

    return NextResponse.json({
      demotedToIntern,
      removedManagers,
      processed:
        qualifiedManagers.length + overdueInterns.length,
    });
  } catch (error) {
    console.error("KPI cron check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
