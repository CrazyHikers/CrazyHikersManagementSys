import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validityDays = await getSetting("waiver_validity_days");

  const [waiver, latestTemplate] = await Promise.all([
    db.userWaiver.findFirst({
      where: {
        userEmail: session.user.email,
        status: { in: ["approved", "expiring"] },
      },
      orderBy: { signedAt: "desc" },
    }),
    db.waiverTemplate.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    }),
  ]);

  const latestVersion = latestTemplate?.version ?? null;

  if (!waiver) {
    return NextResponse.json({
      hasValidWaiver: false,
      expiresAt: null,
      validityDays,
      latestVersion,
      signedVersion: null,
    });
  }

  const expiresAt = new Date(waiver.signedAt);
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  return NextResponse.json({
    hasValidWaiver: true,
    expiresAt: expiresAt.toISOString(),
    validityDays,
    latestVersion,
    signedVersion: waiver.signedVersion,
  });
}
