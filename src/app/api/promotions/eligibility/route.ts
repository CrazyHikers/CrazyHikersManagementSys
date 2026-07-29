import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getFlagSettings, banActiveCutoff, isBanActive, isFlagExpired } from "@/lib/flags";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any;
  const email: string = user.email;
  const role: string = user.role || "member";
  const now = new Date();

  const thresholds = await getSettings([
    "promotion_min_attended_activities",
    "promotion_min_distinct_managers",
    "promotion_min_managed_activities",
    "promotion_min_comanaged_activities",
    "promotion_referral_count",
  ]);

  const attendedRegistrations = await db.registration.findMany({
    where: { userEmail: email, status: "attended" },
    include: {
      activity: {
        include: {
          activityManagers: { where: { role: "manager", status: "confirmed" } },
        },
      },
    },
  });
  const attendedCount = attendedRegistrations.length;
  const distinctManagerCount = new Set(
    attendedRegistrations.flatMap((r) =>
      r.activity.activityManagers.map((am) => am.userEmail)
    )
  ).size;

  const flagSettings = await getFlagSettings();
  const candidateFlags = await db.userFlag.findMany({
    where: {
      userEmail: email,
      invalidated: false,
      activity: { date: { gt: banActiveCutoff(flagSettings, now) } },
    },
    include: { activity: { select: { date: true } } },
  });
  const activeFlag = candidateFlags.find(
    (f) => isBanActive(f, flagSettings, now) && !isFlagExpired(f, flagSettings, now)
  );

  const pendingRequest = await db.promotionRequest.findFirst({
    where: { userEmail: email, status: { in: ["pending", "pending_admin_review"] } },
    include: {
      poll: {
        include: {
          _count: { select: { electorate: true, participations: true } },
        },
      },
    },
  });

  const managerProfile = await db.managerProfile.findUnique({
    where: { userEmail: email },
  });

  const managedCount = await db.activityManager.count({
    where: {
      userEmail: email,
      role: "manager",
      status: "confirmed",
      activity: { status: "completed" },
    },
  });

  const comanagedCount = await db.activityManager.count({
    where: {
      userEmail: email,
      role: "comanager",
      status: "confirmed",
      activity: { status: "completed" },
    },
  });

  // Available referrals (non-intern managers) for member->intern
  const qualifiedManagers = await db.user.findMany({
    where: { role: { in: ["manager", "admin", "dev"] } },
    include: { managerProfile: true },
  });
  const availableReferrals = qualifiedManagers
    .filter((u) => u.managerProfile && !u.managerProfile.intern)
    .map((u) => ({ email: u.email, name: u.name }));

  return NextResponse.json({
    role,
    isIntern: managerProfile?.intern ?? false,
    attendedCount,
    distinctManagerCount,
    hasActiveFlag: !!activeFlag,
    managedCount,
    comanagedCount,
    pendingRequest,
    availableReferrals,
    thresholds: {
      minAttendedActivities: thresholds.promotion_min_attended_activities,
      minDistinctManagers: thresholds.promotion_min_distinct_managers,
      minManagedActivities: thresholds.promotion_min_managed_activities,
      minComanagedActivities: thresholds.promotion_min_comanaged_activities,
      referralCount: thresholds.promotion_referral_count,
    },
  });
}
