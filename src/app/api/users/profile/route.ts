import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { managerProfile: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
    role: user.role,
    tag: user.managerProfile?.tag || null,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, tag } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { email: session.user.email },
    data: { name: name.trim() },
    include: { managerProfile: true },
  });

  // Update tag if provided and user has a manager profile
  if (tag !== undefined && updated.managerProfile) {
    await db.managerProfile.update({
      where: { userEmail: session.user.email },
      data: { tag: tag.trim() },
    });
  }

  return NextResponse.json({
    email: updated.email,
    name: updated.name,
    role: updated.role,
    tag: tag !== undefined ? tag.trim() : (updated.managerProfile?.tag || null),
  });
}
