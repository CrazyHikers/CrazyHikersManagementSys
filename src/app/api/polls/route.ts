import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can, getUserRole } from "@/lib/permissions";
import {
  createPoll,
  listPolls,
  prismaPollDatabase,
} from "@/lib/polls/service";
import { pollErrorCode, pollErrorStatus } from "@/lib/polls/http";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(session, "polls.read")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const polls = await listPolls(prismaPollDatabase, {
      email: session.user.email,
      role: getUserRole(session),
      isIntern:
        (session.user as { isIntern?: boolean }).isIntern === true,
    });
    return NextResponse.json({ polls });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] list failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(session, "polls.manage")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const poll = await createPoll(
      prismaPollDatabase,
      session.user.email,
      body,
    );
    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] create failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}
