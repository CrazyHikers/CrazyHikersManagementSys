import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Read the validity window from system settings so admins can adjust
    // it without a code change.
    const validityDays = await getSetting("waiver_validity_days");
    const expiredCutoff = new Date();
    expiredCutoff.setDate(expiredCutoff.getDate() - validityDays);

    // Mark waivers older than the validity window as expired. Users will be
    // prompted to sign a new waiver the next time they try to register.
    const result = await db.userWaiver.updateMany({
      where: {
        signedAt: { lt: expiredCutoff },
        status: "approved",
      },
      data: { status: "expired" },
    });

    return NextResponse.json({ expired: result.count });
  } catch (error) {
    console.error("Cron waiver check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
