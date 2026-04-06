import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const waivers = await db.userWaiver.findMany({
    where: { userEmail: session.user.email },
    orderBy: { signedAt: "desc" },
  });

  return NextResponse.json(waivers);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.type === "esign") {
    // E-sign flow: auto-approve
    const { version, signedName } = body;
    if (!version || typeof version !== "number") {
      return NextResponse.json({ error: "Version required" }, { status: 400 });
    }
    if (!signedName || typeof signedName !== "string" || !signedName.trim()) {
      return NextResponse.json({ error: "Legal name required" }, { status: 400 });
    }

    const fileId = `esign-${randomUUID()}`;
    const userEmail = session.user.email;

    await db.$transaction([
      db.userWaiver.updateMany({
        where: { userEmail, status: "approved" },
        data: { status: "expired" },
      }),
      db.userWaiver.create({
        data: {
          fileId,
          userEmail,
          status: "approved",
          signedVersion: version,
          signedName: signedName.trim(),
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  }

  // Legacy upload flow
  const { fileId } = body;
  if (!fileId) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 });
  }

  await db.userWaiver.create({
    data: {
      fileId,
      userEmail: session.user.email,
      status: "pending_approval",
    },
  });

  return NextResponse.json({ success: true });
}
