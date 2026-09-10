import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ albumUrl: null }, { status: 401, headers });
  const { id } = await params;
  // Attendance is checked on each request; neither role nor a confirmed signup grants access.
  const registration = await db.registration.findFirst({
    where: { activityId: id, userEmail: session.user.email, status: "attended", activity: { status: "completed" } },
    select: { activity: { select: { album: { select: { url: true } } } } },
  });
  return NextResponse.json({ albumUrl: registration?.activity.album?.url ?? null }, { headers });
}
