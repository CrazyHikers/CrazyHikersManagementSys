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
    profile: (user as Record<string, unknown>).profile || {},
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, tag, profile } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Build update data
  const updateData: Record<string, unknown> = { name: name.trim() };

  // Merge profile fields if provided
  if (profile && typeof profile === "object") {
    const existingUser = await db.user.findUnique({
      where: { email: session.user.email },
    });
    const existingProfile = (existingUser as Record<string, unknown>)?.profile;
    const merged = {
      ...(typeof existingProfile === "object" && existingProfile !== null ? existingProfile : {}),
      ...profile,
    };
    updateData.profile = merged;
  }

  const updated = await db.user.update({
    where: { email: session.user.email },
    data: updateData,
    include: { managerProfile: true },
  });

  // Update or create tag for manager+ roles
  if (tag !== undefined && ["manager", "admin", "dev"].includes(updated.role)) {
    if (updated.managerProfile) {
      await db.managerProfile.update({
        where: { userEmail: session.user.email },
        data: { tag: tag.trim() },
      });
    } else {
      await db.managerProfile.create({
        data: {
          userEmail: session.user.email,
          tag: tag.trim() || session.user.email,
          intern: false,
        },
      });
    }
  }

  return NextResponse.json({
    email: updated.email,
    name: updated.name,
    role: updated.role,
    tag: tag !== undefined ? tag.trim() : (updated.managerProfile?.tag || null),
    profile: (updated as Record<string, unknown>).profile || {},
  });
}
