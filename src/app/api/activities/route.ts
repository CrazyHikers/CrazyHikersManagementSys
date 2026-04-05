import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { sendComanagerInvitation } from "@/lib/email";
import { randomUUID } from "crypto";

export async function GET() {
  const activities = await db.activity.findMany({
    include: {
      activityManagers: {
        where: { status: "confirmed" },
        include: { user: true },
      },
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["registration_confirmed", "attended"] } },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(activities);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "activities.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      coverImgId,
      deadline,
      date,
      capacity = 0,
      maximumRegistration = 0,
      userEmail,
      comanagerEmails = [],
      metadata,
    } = body;

    if (!title || !deadline || !date || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate deadline is in the future
    const deadlineDate = new Date(deadline + "T23:59:59");
    const activityDate = new Date(date + "T06:00:00");
    const now = new Date();

    if (deadlineDate <= now) {
      return NextResponse.json(
        { error: "Deadline must be in the future" },
        { status: 400 }
      );
    }

    if (activityDate <= deadlineDate) {
      return NextResponse.json(
        { error: "Activity date must be after the deadline" },
        { status: 400 }
      );
    }

    // Check intern rule: intern managers need at least one qualified comanager
    const manager = await db.user.findUnique({
      where: { email: userEmail },
      include: { managerProfile: true },
    });
    if (manager?.managerProfile?.intern && comanagerEmails.length > 0) {
      const qualifiedComanagers = await db.managerProfile.findMany({
        where: {
          userEmail: { in: comanagerEmails },
          intern: false,
        },
      });
      if (qualifiedComanagers.length === 0) {
        return NextResponse.json(
          { error: "Intern managers must have at least one qualified co-manager" },
          { status: 400 }
        );
      }
    }

    // Generate tokens for comanager invitations
    const comanagerData = comanagerEmails.map((email: string) => ({
      userEmail: email,
      role: "comanager" as const,
      status: "invited" as const,
      token: randomUUID(),
    }));

    const activity = await db.activity.create({
      data: {
        title,
        description: description || "",
        coverImgId: coverImgId || "",
        deadline: deadlineDate,
        date: activityDate,
        capacity,
        maximumRegistration,
        ...(metadata ? { metadata } : {}),
        status: "open",
        activityManagers: {
          create: [
            { userEmail, role: "manager", status: "confirmed" },
            ...comanagerData,
          ],
        },
      },
    });

    // Send invitation emails to comanagers
    const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
    const managerName = session.user?.name || userEmail;
    for (const cm of comanagerData) {
      const comanager = await db.user.findUnique({ where: { email: cm.userEmail } });
      const inviteUrl = `${baseUrl}/invitations/comanager/${cm.token}`;
      await sendComanagerInvitation(
        cm.userEmail,
        comanager?.name || cm.userEmail,
        title,
        inviteUrl
      ).catch((err) => console.error("[EMAIL] Comanager invite failed:", err));
    }

    return NextResponse.json({ id: activity.id });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
