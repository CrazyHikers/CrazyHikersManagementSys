import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Returns the current user's registration and managing status for all open activities.
// Used by the home page client component to show personalized badges without
// forcing the entire page into dynamic rendering.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ registered: [], managing: [] });
  }

  const email = session.user.email;

  const [registrations, managedActivities] = await Promise.all([
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
  ]);

  return NextResponse.json({
    registered: registrations.map((r) => r.activityId),
    managing: managedActivities.map((m) => m.activityId),
  });
}
