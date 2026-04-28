import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  notify,
  confirmRegistrationsReminderDispatch,
  finalizeActivityReminderDispatch,
} from "@/lib/notify";
import { findSameDayCommitment } from "@/lib/activity";
import { getFlagSettings, isBanActive, unexpiredCutoff } from "@/lib/flags";

// Daily sweep that fires two manager-targeted reminders:
//
//  1. confirm_registrations_reminder — for activities whose deadline has
//     passed but registrations are still pending, capacity is not yet
//     filled, and at least one pending registration is actually confirmable
//     (i.e. user isn't shadow-banned and has no same-day conflict). Without
//     these filters managers would get nagged about activities where there's
//     nothing they can do.
//
//  2. finalize_activity_reminder — for activities whose date has passed but
//     status is still "open". Sent until the manager marks them
//     finished/cancelled.
//
// No tracking column needed: each reminder query naturally returns nothing
// once the manager acts, so daily firing self-stops.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let confirmRemindersSent = 0;
  let finalizeRemindersSent = 0;

  try {
    // --- 1. Confirm-registrations reminder ----------------------------------
    const flagSettings = await getFlagSettings();
    const flagCutoff = unexpiredCutoff(flagSettings);

    const confirmCandidates = await db.activity.findMany({
      where: {
        status: "open",
        deadline: { lt: now },
        date: { gte: todayStart }, // future activities only
      },
      include: {
        registrations: {
          where: { status: "registered" },
          include: {
            user: {
              include: {
                flags: {
                  where: {
                    issuedAt: { gt: flagCutoff },
                    invalidated: false,
                  },
                },
              },
            },
          },
        },
        activityManagers: {
          where: { status: "confirmed" },
          select: { userEmail: true },
        },
        _count: {
          select: {
            registrations: {
              where: { status: { in: ["registration_confirmed", "attended"] } },
            },
          },
        },
      },
    });

    for (const activity of confirmCandidates) {
      // Skip if capacity is already full (or unset/0 means no limit, but
      // an unset capacity means there's no upper bound — managers still
      // need to confirm individual registrations).
      if (
        activity.capacity > 0 &&
        activity._count.registrations >= activity.capacity
      ) {
        continue;
      }

      // Filter shadow-banned users out of pending — managers can't act on
      // those rows anyway.
      const notBanned = activity.registrations.filter(
        (r) => !r.user.flags.some((f) => isBanActive(f, flagSettings, now))
      );

      // Filter same-day conflicts. Sequential to keep DB pressure low.
      const confirmable: typeof notBanned = [];
      for (const r of notBanned) {
        const conflict = await findSameDayCommitment(
          r.userEmail,
          activity.date,
          activity.id
        );
        if (!conflict) confirmable.push(r);
      }

      if (confirmable.length === 0) continue;

      const dispatch = confirmRegistrationsReminderDispatch({
        activityId: activity.id,
        activityTitle: activity.title,
        pendingCount: confirmable.length,
        url: `${baseUrl}/dashboard/activities/${activity.id}`,
      });
      for (const am of activity.activityManagers) {
        try {
          await notify(am.userEmail, dispatch);
          confirmRemindersSent++;
        } catch (err) {
          console.error(
            "[cron/manager-reminders] confirm reminder failed for",
            am.userEmail,
            err
          );
        }
      }
    }

    // --- 2. Finalize-activity reminder --------------------------------------
    const finalizeCandidates = await db.activity.findMany({
      where: {
        status: "open",
        date: { lt: todayStart },
      },
      include: {
        activityManagers: {
          where: { status: "confirmed" },
          select: { userEmail: true },
        },
      },
    });

    for (const activity of finalizeCandidates) {
      const dispatch = finalizeActivityReminderDispatch({
        activityId: activity.id,
        activityTitle: activity.title,
        url: `${baseUrl}/dashboard/activities/${activity.id}`,
      });
      for (const am of activity.activityManagers) {
        try {
          await notify(am.userEmail, dispatch);
          finalizeRemindersSent++;
        } catch (err) {
          console.error(
            "[cron/manager-reminders] finalize reminder failed for",
            am.userEmail,
            err
          );
        }
      }
    }

    return NextResponse.json({
      confirmRemindersSent,
      finalizeRemindersSent,
    });
  } catch (error) {
    console.error("Cron manager-reminders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
