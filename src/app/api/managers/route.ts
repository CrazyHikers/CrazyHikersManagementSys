import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-utils";
import { computeKpi } from "@/lib/kpi";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(session, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managers = await db.user.findMany({
    where: { role: { in: ["manager", "admin"] } },
    include: { managerProfile: true },
    orderBy: { name: "asc" },
  });

  // Compute KPI on the fly for each manager
  const managersWithKpi = await Promise.all(
    managers.map(async (m) => ({
      ...m,
      managerProfile: m.managerProfile
        ? { ...m.managerProfile, kpi: await computeKpi(m.email) }
        : null,
    }))
  );

  return NextResponse.json(managersWithKpi);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(session, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { email, tag } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role === "member") {
        // Upgrade existing member to manager
        const updated = await db.user.update({
          where: { email },
          data: { role: "manager" },
        });
        // Create manager profile
        await db.managerProfile.create({
          data: { userEmail: email, tag: tag || email, intern: true, internSince: new Date() },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json(
        { error: "User is already a manager or admin" },
        { status: 409 }
      );
    }

    // Create new user as manager with profile
    const user = await db.user.create({
      data: {
        email,
        name: email, // placeholder name
        role: "manager",
        managerProfile: {
          create: { tag: tag || email, intern: true, internSince: new Date() },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Create manager error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
