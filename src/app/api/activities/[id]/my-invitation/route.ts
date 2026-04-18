import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ token: null });
  }

  const { id: activityId } = await params;
  const invitation = await db.activityManager.findUnique({
    where: {
      activityId_userEmail: { activityId, userEmail: session.user.email },
    },
    select: { status: true, token: true },
  });

  if (invitation?.status !== "invited" || !invitation.token) {
    return NextResponse.json({ token: null });
  }

  return NextResponse.json({ token: invitation.token });
}
