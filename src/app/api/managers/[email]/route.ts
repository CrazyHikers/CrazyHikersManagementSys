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
  if (!can(session, "managers.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);
  const body = await request.json();

  try {
    const user = await db.user.findUnique({
      where: { email: decodedEmail },
      include: { managerProfile: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update role on user table
    if (body.role !== undefined) {
      await db.user.update({
        where: { email: decodedEmail },
        data: { role: body.role },
      });
    }

    // Update manager profile fields
    const profileFields: Record<string, unknown> = {};
    if (body.tag !== undefined) profileFields.tag = body.tag;
    if (body.intern !== undefined) profileFields.intern = body.intern;

    if (Object.keys(profileFields).length > 0 && user.managerProfile) {
      await db.managerProfile.update({
        where: { userEmail: decodedEmail },
        data: profileFields,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update manager error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
