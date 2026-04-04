import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId, memberId, action } = await request.json();

  if (!fileId || !memberId || !["approve", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "approve") {
    // Expire all existing approved waivers, then approve this one
    await db.$transaction([
      db.memberWaiver.updateMany({
        where: { memberId, status: "approved" },
        data: { status: "expired" },
      }),
      db.memberWaiver.update({
        where: { fileId },
        data: { status: "approved" },
      }),
    ]);
  } else {
    await db.memberWaiver.update({
      where: { fileId },
      data: { status: "rejected" },
    });
  }

  return NextResponse.json({ success: true });
}
