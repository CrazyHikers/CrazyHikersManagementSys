import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Returns the current user's registration and managing status for all open activities.
// Used by the home page client component to show personalized badges without
// forcing the entire page into dynamic rendering.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ registered: [], managing: [], pendingInvitation: [] });
  }

  const email = session.user.email;

  const [registrations, managedActivities, pendingInvitations, confirmedCommitments] = await Promise.all([
    db.registration.findMany({
      where: {
        userEmail: email,
        status: { in: ["registered", "registration_confirmed"] },
        activity: { status: "open" },
      },
      select: { activityId: true },
    }),
    db.activityManager.findMany({
      where: {
        userEmail: email,
        status: "confirmed",
        activity: { status: "open" },
      },
      select: { activityId: true },
    }),
    db.activityManager.findMany({
      where: {
        userEmail: email,
        status: "invited",
        activity: { status: "open" },
      },
      select: { activityId: true },
    }),
    // Dates the user has a confirmed commitment on (as member or manager).
    // Used by the homepage to flag same-day conflicts on other activity
    // cards so users see the conflict before hitting the register button.
    Promise.all([
      db.registration.findMany({
        where: {
          userEmail: email,
          status: "registration_confirmed",
          activity: { status: { not: "cancelled" } },
        },
        select: { activityId: true, activity: { select: { date: true, title: true } } },
      }),
      db.activityManager.findMany({
        where: {
          userEmail: email,
          status: "confirmed",
          activity: { status: { not: "cancelled" } },
        },
        select: { activityId: true, activity: { select: { date: true, title: true } } },
      }),
    ]).then(([regs, mgmts]) => [
      ...regs.map((r) => ({ activityId: r.activityId, date: r.activity.date, title: r.activity.title, role: "member" as const })),
      ...mgmts.map((m) => ({ activityId: m.activityId, date: m.activity.date, title: m.activity.title, role: "manager" as const })),
    ]),
  ]);

  // Map commitment day (local YYYY-MM-DD) → conflict info. If the user
  // has multiple commitments on the same day (should not happen after
  // enforcement, but may exist in legacy data), the first wins.
  const conflictsByDate: Record<string, { activityId: string; title: string; role: "member" | "manager" }> = {};
  for (const c of confirmedCommitments) {
    const d = new Date(c.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!conflictsByDate[key]) {
      conflictsByDate[key] = { activityId: c.activityId, title: c.title, role: c.role };
    }
  }

  return NextResponse.json({
    registered: registrations.map((r) => r.activityId),
    managing: managedActivities.map((m) => m.activityId),
    pendingInvitation: pendingInvitations.map((m) => m.activityId),
    conflictsByDate,
  });
}
