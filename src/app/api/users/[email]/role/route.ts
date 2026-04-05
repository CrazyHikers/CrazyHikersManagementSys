import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "users.changeRole")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);
  const { role } = await request.json();

  const validRoles = ["dev", "admin", "manager", "member"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: decodedEmail } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent changing own role
  if (decodedEmail === session.user.email) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const oldRole = user.role;

  // If upgrading to manager, ensure manager profile exists
  if ((role === "manager" || role === "admin" || role === "dev") && oldRole === "member") {
    const profile = await db.managerProfile.findUnique({ where: { userEmail: decodedEmail } });
    if (!profile && (role === "manager")) {
      await db.managerProfile.create({
        data: { userEmail: decodedEmail, tag: decodedEmail, intern: true, internSince: new Date() },
      });
    }
  }

  // If downgrading from manager to member, remove manager profile
  if (role === "member" && (oldRole === "manager" || oldRole === "admin" || oldRole === "dev")) {
    await db.managerProfile.deleteMany({ where: { userEmail: decodedEmail } });
  }

  await db.user.update({
    where: { email: decodedEmail },
    data: { role },
  });

  return NextResponse.json({ success: true, oldRole, newRole: role });
}
