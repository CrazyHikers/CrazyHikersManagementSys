import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settlePoll } from "@/lib/polls/settlement";

export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const expired = await db.poll.findMany({
      where: {
        kind: "approval",
        autoSettle: true,
        status: "open",
        outcome: null,
        deadline: { lte: now },
      },
      select: { id: true },
    });
    let settled = 0;
    for (const poll of expired) {
      const result = await settlePoll(db, poll.id, now);
      if (result.changed) settled += 1;
    }
    return NextResponse.json({ processed: expired.length, settled });
  } catch (error) {
    console.error("[cron/polls] settlement failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
