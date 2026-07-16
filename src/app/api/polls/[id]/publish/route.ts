import { after, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pollErrorCode, pollErrorStatus } from "@/lib/polls/http";
import { notifyPublishedPoll } from "@/lib/polls/notifications";
import { prismaPollDatabase, publishPoll } from "@/lib/polls/service";

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
    const poll = await publishPoll(
      prismaPollDatabase,
      session.user.email,
      id,
    );
    after(async () => {
      try {
        await notifyPublishedPoll(poll);
      } catch (error) {
        console.error("[polls] notification audience lookup failed", error);
      }
    });
    return NextResponse.json({ poll });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] publish failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}
