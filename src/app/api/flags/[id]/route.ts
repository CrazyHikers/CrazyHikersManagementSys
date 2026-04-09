import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorize } from "@/lib/permissions";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await authorize("flags.manage");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const flag = await db.userFlag.findUnique({ where: { id } });
  if (!flag) {
    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  }
  if (flag.invalidated) {
    return NextResponse.json({ error: "Flag is already invalidated" }, { status: 400 });
  }

  const updated = await db.userFlag.update({
    where: { id },
    data: {
      invalidated: true,
      invalidatedBy: session.user!.email!,
      invalidatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, flag: updated });
}
