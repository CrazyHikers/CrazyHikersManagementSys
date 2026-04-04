import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPromotionResultEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all expired pending requests
    const expired = await db.promotionRequest.findMany({
      where: { status: "pending", expiresAt: { lte: new Date() } },
      include: { votes: true, user: true },
    });

    for (const req of expired) {
      if (req.type === "intern_to_qualified") {
        // Tally valid votes only (those who actually voted)
        const validVotes = req.votes.filter((v) => v.approved !== null);

        if (validVotes.length === 0) {
          // No one voted -- expired
          await db.promotionRequest.update({
            where: { id: req.id },
            data: { status: "expired", resolvedAt: new Date() },
          });
          await sendPromotionResultEmail(
            req.userEmail,
            req.user.name,
            false,
            "",
            ["No votes were cast within the voting period."]
          );
          continue;
        }

        const approveCount = validVotes.filter((v) => v.approved).length;
        const approvalRatio = await getSetting("promotion_vote_approval_ratio");
        const promoted = (approveCount / validVotes.length) * 100 >= approvalRatio;

        if (promoted) {
          // Move to pending admin review instead of auto-promoting
          await db.promotionRequest.update({
            where: { id: req.id },
            data: { status: "pending_admin_review" },
          });
          console.log(
            `Expired promotion request ${req.id} for ${req.userEmail} (intern_to_qualified) passed vote threshold, now pending admin review`
          );
        } else {
          const reasons = validVotes
            .filter((v) => !v.approved && v.reason)
            .map((v) => v.reason!);
          await db.promotionRequest.update({
            where: { id: req.id },
            data: { status: "rejected", resolvedAt: new Date() },
          });
          await sendPromotionResultEmail(
            req.userEmail,
            req.user.name,
            false,
            "",
            reasons
          );
        }
      } else {
        // member_to_intern: if expired without both approvals, reject
        await db.promotionRequest.update({
          where: { id: req.id },
          data: { status: "expired", resolvedAt: new Date() },
        });
        await sendPromotionResultEmail(req.userEmail, req.user.name, false, "", [
          "The referral period expired without both approvals.",
        ]);
      }
    }

    return NextResponse.json({ processed: expired.length });
  } catch (error) {
    console.error("Cron promotion check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
