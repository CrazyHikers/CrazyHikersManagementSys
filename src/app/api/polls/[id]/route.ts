import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can, getUserRole } from "@/lib/permissions";
import {
  getPollDetail,
  prismaPollDatabase,
  updatePoll,
} from "@/lib/polls/service";
import { pollErrorCode, pollErrorStatus } from "@/lib/polls/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(session, "polls.read")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const poll = await getPollDetail(
      prismaPollDatabase,
      {
        email: session.user.email,
        role: getUserRole(session),
      isIntern:
        (session.user as { isIntern?: boolean }).isIntern === true,
      },
      id,
    );
    return NextResponse.json({ poll });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] detail failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  try {
    const poll = await updatePoll(
      prismaPollDatabase,
      session.user.email,
      id,
      body,
    );
    return NextResponse.json({ poll });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] update failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}
