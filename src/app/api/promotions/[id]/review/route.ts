import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { sendPromotionResultEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "promotions.review")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { approved, reason } = await request.json();

  const promotionRequest = await db.promotionRequest.findUnique({
    where: { id },
    include: { user: true, votes: true },
  });

  if (!promotionRequest) {
    return NextResponse.json(
      { error: "Promotion request not found" },
      { status: 404 }
    );
  }

  if (promotionRequest.status !== "pending_admin_review") {
    return NextResponse.json(
      { error: "Request is not pending admin review" },
      { status: 400 }
    );
  }

  if (approved) {
    if (promotionRequest.type === "member_to_intern") {
      await db.$transaction([
        db.user.update({
          where: { email: promotionRequest.userEmail },
          data: { role: "manager" },
        }),
        db.managerProfile.create({
          data: {
            userEmail: promotionRequest.userEmail,
            tag: promotionRequest.userEmail,
            intern: true,
            internSince: new Date(),
          },
        }),
        db.promotionRequest.update({
          where: { id },
          data: { status: "approved", resolvedAt: new Date() },
        }),
      ]);
      await sendPromotionResultEmail(
        promotionRequest.userEmail,
        promotionRequest.user.name,
        true,
        "Intern Manager"
      );
    } else {
      // intern_to_qualified
      await db.$transaction([
        db.managerProfile.update({
          where: { userEmail: promotionRequest.userEmail },
          data: { intern: false },
        }),
        db.promotionRequest.update({
          where: { id },
          data: { status: "approved", resolvedAt: new Date() },
        }),
      ]);
      await sendPromotionResultEmail(
        promotionRequest.userEmail,
        promotionRequest.user.name,
        true,
        "Qualified Manager"
      );
    }
  } else {
    // Rejected by admin
    await db.promotionRequest.update({
      where: { id },
      data: { status: "rejected", resolvedAt: new Date() },
    });
    await sendPromotionResultEmail(
      promotionRequest.userEmail,
      promotionRequest.user.name,
      false,
      "",
      reason ? [reason] : ["Rejected by admin review."]
    );
  }

  return NextResponse.json({ success: true });
}
