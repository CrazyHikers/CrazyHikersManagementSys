import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { computeKpi } from "@/lib/kpi";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "managers.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managers = await db.user.findMany({
    where: { role: { in: ["manager", "admin", "dev"] } },
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

