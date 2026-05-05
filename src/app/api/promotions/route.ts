import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  sendPromotionReferralEmail,
  sendPromotionVoteEmail,
} from "@/lib/email";
import type { CandidateActivities } from "@/lib/email";
import { getSetting } from "@/lib/settings";
import { getFlagSettings, banActiveCutoff, isBanActive, isFlagExpired } from "@/lib/flags";
import { getBaseUrl } from "@/lib/url";
import type { PromotionStatus } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "promotions.vote")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const requests = await db.promotionRequest.findMany({
    where: status ? { status: status as PromotionStatus } : undefined,
    include: { votes: true, user: true },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any;
  const email: string = user.email;
  const role: string = user.role || "member";

  // Determine promotion type
  let type: "member_to_intern" | "intern_to_qualified";

  if (role === "member") {
    type = "member_to_intern";
  } else if (role === "manager") {
    const profile = await db.managerProfile.findUnique({
      where: { userEmail: email },
    });
    if (profile?.intern) {
      type = "intern_to_qualified";
    } else {
      return NextResponse.json(
        { error: "You are already a qualified manager" },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "Admins cannot request promotions" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const referralEmails: string[] | undefined = body.referralEmails;
  const applicationText: string | undefined = body.applicationText;

  // Check no pending request
  const pendingRequest = await db.promotionRequest.findFirst({
    where: { userEmail: email, status: { in: ["pending", "pending_admin_review"] } },
  });
  if (pendingRequest) {
    return NextResponse.json(
      { error: "You already have a pending request" },
      { status: 400 }
    );
  }

  if (type === "member_to_intern") {
    // Validate referral emails provided
    const referralCount = await getSetting("promotion_referral_count");
    if (!referralEmails || referralEmails.length !== referralCount) {
      return NextResponse.json(
        { error: `Need exactly ${referralCount} non-intern manager referrals` },
        { status: 400 }
      );
    }

    // Must have >= N attended activities with >= M different main managers
    const minAttended = await getSetting("promotion_min_attended_activities");
    const minManagers = await getSetting("promotion_min_distinct_managers");

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
    if (attendedRegistrations.length < minAttended) {
      return NextResponse.json(
        { error: `Need at least ${minAttended} attended activities` },
        { status: 400 }
      );
    }

    const distinctMainManagers = new Set(
      attendedRegistrations.flatMap((r) =>
        r.activity.activityManagers.map((am) => am.userEmail)
      )
    );
    if (distinctMainManagers.size < minManagers) {
      return NextResponse.json(
        { error: `Need activities with at least ${minManagers} different main managers` },
        { status: 400 }
      );
    }

    // Must have no active flags
    const flagSettings = await getFlagSettings();
    const now = new Date();
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
    if (activeFlag) {
      return NextResponse.json(
        { error: "Cannot promote with active flags" },
        { status: 400 }
      );
    }

    // Validate referral emails are non-intern managers
    const referrals = await db.user.findMany({
      where: {
        email: { in: referralEmails },
        role: { in: ["manager", "admin", "dev"] },
      },
      include: { managerProfile: true },
    });
    const nonInternReferrals = referrals.filter(
      (r) => r.managerProfile && !r.managerProfile.intern
    );
    if (nonInternReferrals.length !== referralCount) {
      return NextResponse.json(
        { error: `Need exactly ${referralCount} non-intern manager referrals` },
        { status: 400 }
      );
    }
  } else {
    // intern_to_qualified eligibility
    const minManaged = await getSetting("promotion_min_managed_activities");
    const minComanaged = await getSetting("promotion_min_comanaged_activities");

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
    if (managedCount < minManaged || comanagedCount < minComanaged) {
      return NextResponse.json(
        {
          error:
            `Need at least ${minManaged} managed and ${minComanaged} co-managed completed activities`,
        },
        { status: 400 }
      );
    }
  }

  // Determine voters
  let voterEmails: string[];
  if (type === "member_to_intern") {
    voterEmails = referralEmails!;
  } else {
    const qualifiedManagers = await db.managerProfile.findMany({
      where: { intern: false },
      select: { userEmail: true },
    });
    voterEmails = qualifiedManagers
      .map((m) => m.userEmail)
      .filter((e) => e !== email);
  }

  const voteDurationHours = await getSetting("promotion_vote_duration_hours");
  const expiresAt = new Date(Date.now() + voteDurationHours * 3600000);

  try {
    const promotionRequest = await db.promotionRequest.create({
      data: {
        userEmail: email,
        type,
        expiresAt,
        applicationText: applicationText || null,
        votes: {
          create: voterEmails.map((voterEmail) => ({
            voterEmail,
            token: randomUUID(),
          })),
        },
      },
      include: { votes: true },
    });

    // Fetch candidate activity history for emails
    const baseUrl = getBaseUrl();

    const [managedActivities, attendedRegistrations] = await Promise.all([
      db.activityManager.findMany({
        where: { userEmail: email, status: "confirmed" },
        include: { activity: { select: { id: true, title: true } } },
      }),
      db.registration.findMany({
        where: { userEmail: email, status: "attended" },
        include: { activity: { select: { id: true, title: true } } },
      }),
    ]);

    const managedIds = new Set(managedActivities.map((am) => am.activityId));
    const candidateActivities: CandidateActivities = {
      managed: managedActivities
        .filter((am) => am.role === "manager")
        .map((am) => ({ title: am.activity.title, url: `${baseUrl}/dashboard/activity-view/${am.activityId}` })),
      comanaged: managedActivities
        .filter((am) => am.role === "comanager")
        .map((am) => ({ title: am.activity.title, url: `${baseUrl}/dashboard/activity-view/${am.activityId}` })),
      attended: attendedRegistrations
        .filter((r) => !managedIds.has(r.activityId))
        .map((r) => ({ title: r.activity.title, url: `${baseUrl}/dashboard/activity-view/${r.activityId}` })),
    };

    // Send emails
    for (const vote of promotionRequest.votes) {
      const voteUrl = `${baseUrl}/promotions/vote/${vote.token}`;
      const voter = await db.user.findUnique({
        where: { email: vote.voterEmail },
      });
      const voterName = voter?.name || vote.voterEmail;
      const requesterName = user.name || email;

      if (type === "member_to_intern") {
        await sendPromotionReferralEmail(
          vote.voterEmail,
          voterName,
          requesterName,
          voteUrl,
          candidateActivities
        );
      } else {
        await sendPromotionVoteEmail(
          vote.voterEmail,
          voterName,
          requesterName,
          voteUrl,
          candidateActivities
        );
      }
    }

    return NextResponse.json({ id: promotionRequest.id });
  } catch (error) {
    console.error("Create promotion request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
