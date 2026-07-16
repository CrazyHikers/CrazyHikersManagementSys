import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can, getUserRole } from "@/lib/permissions";
import { pollErrorCode, pollErrorStatus } from "@/lib/polls/http";
import { listParticipants, prismaPollDatabase } from "@/lib/polls/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(session, "polls.manage")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const participants = await listParticipants(
      prismaPollDatabase,
      { email: session.user.email, role: getUserRole(session) },
      id,
    );
    return NextResponse.json({ participants });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] participants failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}
