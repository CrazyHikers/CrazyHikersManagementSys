import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can, getUserRole } from "@/lib/permissions";
import { pollErrorCode, pollErrorStatus } from "@/lib/polls/http";
import { prismaPollDatabase, submitBallot } from "@/lib/polls/service";
import { notifyPromotionSettlement } from "@/lib/promotions/settlement-notification";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(session, "polls.vote")) {
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
    const result = await submitBallot(
      prismaPollDatabase,
      {
        email: session.user.email,
        role: getUserRole(session),
      isIntern:
        (session.user as { isIntern?: boolean }).isIntern === true,
      },
      id,
      body,
    );
    if (result.settlement?.changed) {
      try {
        await notifyPromotionSettlement(
          prismaPollDatabase,
          result.settlement,
        );
      } catch (error) {
        console.error("[polls] promotion result notification failed", error);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = pollErrorStatus(error);
    if (status === 500) console.error("[polls] vote failed", error);
    return NextResponse.json({ error: pollErrorCode(error) }, { status });
  }
}
