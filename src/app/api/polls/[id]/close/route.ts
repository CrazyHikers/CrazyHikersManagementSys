import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pollErrorCode, pollErrorStatus } from "@/lib/polls/http";
import { closePoll, prismaPollDatabase } from "@/lib/polls/service";

export async function POST(
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
    const poll = await closePoll(
      prismaPollDatabase,
      session.user.email,
      id,
    );
    return NextResponse.json({ poll });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] close failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}
