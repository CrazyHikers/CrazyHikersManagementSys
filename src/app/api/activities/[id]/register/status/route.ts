import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ status: null });
  }

  const { id: activityId } = await params;
  const registration = await db.registration.findUnique({
    where: {
      activityId_userEmail: { activityId, userEmail: session.user.email },
    },
  });

  return NextResponse.json({ status: registration?.status || null });
}
