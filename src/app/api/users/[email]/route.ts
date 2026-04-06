import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "members.delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);

  // Prevent deleting yourself
  if (decodedEmail === session.user.email) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { email: decodedEmail } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent non-dev from deleting admin/dev users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRole = (session.user as any).role as string;
  if (
    (user.role === "dev" || user.role === "admin") &&
    sessionRole !== "dev"
  ) {
    return NextResponse.json(
      { error: "Only dev can delete admin or dev users" },
      { status: 403 }
    );
  }

  // Delete in a transaction — clear ActivityUpdate author refs first
  // since that relation has no onDelete: Cascade
  await db.$transaction([
    db.activityUpdate.deleteMany({ where: { postedBy: decodedEmail } }),
    db.user.delete({ where: { email: decodedEmail } }),
  ]);

  return NextResponse.json({ success: true });
}
