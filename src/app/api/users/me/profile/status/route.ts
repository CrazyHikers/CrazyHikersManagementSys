import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getMissingProfileFields } from "@/lib/profile";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { profile: true },
  });

  const missingFields = getMissingProfileFields(user?.profile);

  return NextResponse.json({
    isComplete: missingFields.length === 0,
    missingFields,
  });
}
