import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "waivers.approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileId, userEmail, action } = await request.json();

  if (!fileId || !userEmail || !["approve", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "approve") {
    // Expire all existing approved waivers, then approve this one
    await db.$transaction([
      db.userWaiver.updateMany({
        where: { userEmail, status: "approved" },
        data: { status: "expired" },
      }),
      db.userWaiver.update({
        where: { fileId },
        data: { status: "approved" },
      }),
    ]);
  } else {
    await db.userWaiver.update({
      where: { fileId },
      data: { status: "rejected" },
    });
  }

  return NextResponse.json({ success: true });
}
