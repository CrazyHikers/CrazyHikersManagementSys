import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPromotionResultEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const vote = await db.promotionVote.findUnique({
    where: { token },
    include: {
      request: {
        include: {
          user: true,
          votes: true,
        },
      },
    },
  });

  if (!vote) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404 });
  }

  if (vote.approved !== null) {
    return NextResponse.json({ alreadyVoted: true });
  }

  if (vote.request.expiresAt < new Date()) {
    return NextResponse.json({ expired: true });
  }

  // Requester stats
  const attendedCount = await db.registration.count({
    where: { userEmail: vote.request.userEmail, status: "attended" },
  });
  const managedCount = await db.activityManager.count({
    where: {
      userEmail: vote.request.userEmail,
      role: "manager",
      status: "confirmed",
      activity: { status: "completed" },
    },
  });
  const comanagedCount = await db.activityManager.count({
    where: {
      userEmail: vote.request.userEmail,
      role: "comanager",
      status: "confirmed",
      activity: { status: "completed" },
    },
  });

  return NextResponse.json({
    vote,
    stats: { attendedCount, managedCount, comanagedCount },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { approved, reason } = await request.json();

  const vote = await db.promotionVote.findUnique({
    where: { token },
    include: {
      request: {
        include: { votes: true, user: true },
      },
    },
  });

  if (!vote) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404 });
  }

  if (vote.approved !== null) {
    return NextResponse.json({ error: "Already voted" }, { status: 400 });
  }

  if (vote.request.status !== "pending") {
    return NextResponse.json(
      { error: "Request is no longer pending" },
      { status: 400 }
    );
  }

  if (vote.request.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Voting period has expired" },
      { status: 400 }
    );
  }

  // Record vote
  await db.promotionVote.update({
    where: { token },
    data: { approved, reason: reason || null, votedAt: new Date() },
  });

  // Check if promotion should be auto-resolved
  const allVotes = await db.promotionVote.findMany({
    where: { requestId: vote.requestId },
  });

  if (vote.request.type === "member_to_intern") {
    // Both must approve
    const castVotes = allVotes.filter((v) => v.approved !== null);
    if (castVotes.length === allVotes.length) {
      const allApproved = castVotes.every((v) => v.approved);
      if (allApproved) {
        // Move to pending admin review instead of auto-promoting
        await db.promotionRequest.update({
          where: { id: vote.requestId },
          data: { status: "pending_admin_review" },
        });
        console.log(
          `Promotion request ${vote.requestId} for ${vote.request.userEmail} (member_to_intern) is now pending admin review`
        );
      } else {
        await db.promotionRequest.update({
          where: { id: vote.requestId },
          data: { status: "rejected", resolvedAt: new Date() },
        });
        const reasons = castVotes
          .filter((v) => !v.approved && v.reason)
          .map((v) => v.reason!);
        await sendPromotionResultEmail(
          vote.request.userEmail,
          vote.request.user.name,
          false,
          "",
          reasons
        );
      }
    }
  } else {
    // intern_to_qualified: check if all votes are in
    const castVotes = allVotes.filter((v) => v.approved !== null);
    if (castVotes.length === allVotes.length) {
      const approveCount = castVotes.filter((v) => v.approved).length;
      const approvalRatio = await getSetting("promotion_vote_approval_ratio");
      const passed = (approveCount / castVotes.length) * 100 >= approvalRatio;
      if (passed) {
        // Move to pending admin review instead of auto-promoting
        await db.promotionRequest.update({
          where: { id: vote.requestId },
          data: { status: "pending_admin_review" },
        });
        console.log(
          `Promotion request ${vote.requestId} for ${vote.request.userEmail} (intern_to_qualified) is now pending admin review`
        );
      } else {
        await db.promotionRequest.update({
          where: { id: vote.requestId },
          data: { status: "rejected", resolvedAt: new Date() },
        });
        const reasons = castVotes
          .filter((v) => !v.approved && v.reason)
          .map((v) => v.reason!);
        await sendPromotionResultEmail(
          vote.request.userEmail,
          vote.request.user.name,
          false,
          "",
          reasons
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
