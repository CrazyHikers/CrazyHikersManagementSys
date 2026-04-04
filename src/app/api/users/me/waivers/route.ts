import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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

  const { fileId } = await request.json();

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
