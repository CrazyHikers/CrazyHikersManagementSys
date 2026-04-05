import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit by IP: max 10 registrations per IP per 15 minutes
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const { allowed } = rateLimit(`register:${ip}`, { maxAttempts: 10, windowMs: 15 * 60 * 1000 });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { id: activityId } = await params;
    const { email, name, notes, formData } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    // Check activity exists and is open
    const activity = await db.activity.findUnique({ where: { id: activityId } });
    if (!activity || activity.status !== "open") {
      return NextResponse.json(
        { error: "Activity is not open for registration" },
        { status: 400 }
      );
    }

    if (new Date(activity.deadline) <= new Date()) {
      return NextResponse.json(
        { error: "Registration deadline has passed" },
        { status: 400 }
      );
    }

    // Check max registration
    if (activity.maximumRegistration && activity.maximumRegistration > 0) {
      const count = await db.registration.count({
        where: {
          activityId,
          status: { in: ["registered", "registration_confirmed"] },
        },
      });
      if (count >= activity.maximumRegistration) {
        return NextResponse.json(
          { error: "Registration is full" },
          { status: 400 }
        );
      }
    }

    // Find or create user
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: { name, email, role: "member" },
      });
    }

    // Check for approved waiver (required to register)
    const approvedWaiver = await db.userWaiver.findFirst({
      where: { userEmail: user.email, status: "approved" },
    });
    if (!approvedWaiver) {
      return NextResponse.json(
        { error: "You must have an approved waiver before registering for activities. Please submit your waiver first." },
        { status: 403 }
      );
    }

    // Check if already registered
    const existing = await db.registration.findUnique({
      where: {
        activityId_userEmail: { activityId, userEmail: user.email },
      },
    });
    if (existing) {
      if (notes) {
        await db.registration.update({
          where: {
            activityId_userEmail: { activityId, userEmail: user.email },
          },
          data: { notes: existing.notes ? `${existing.notes}\n${notes}` : notes },
        });
      }
      return NextResponse.json({ message: "Already registered" });
    }

    // Check for same-day conflict (can't register for two activities on the same date)
    const activityDate = new Date(activity.date);
    const dayStart = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const sameDayRegistration = await db.registration.findFirst({
      where: {
        userEmail: user.email,
        status: { in: ["registered", "registration_confirmed"] },
        activity: {
          date: { gte: dayStart, lt: dayEnd },
          id: { not: activityId },
        },
      },
      include: { activity: { select: { title: true } } },
    });
    if (sameDayRegistration) {
      return NextResponse.json(
        { error: `You are already registered for "${sameDayRegistration.activity.title}" on the same day.` },
        { status: 400 }
      );
    }

    // Create registration — shadow ban is checked at query time
    await db.registration.create({
      data: {
        activityId,
        userEmail: user.email,
        status: "registered",
        notes: notes || null,
        ...(formData && typeof formData === "object" ? { formData } : {}),
      } as Parameters<typeof db.registration.create>[0]["data"],
    });

    return NextResponse.json({ message: "Registration successful" });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Withdraw registration (user must be logged in, can only withdraw own, before deadline)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: activityId } = await params;
    const userEmail = session.user.email;

    const activity = await db.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Can only withdraw before the registration deadline
    if (new Date(activity.deadline) <= new Date()) {
      return NextResponse.json(
        { error: "Cannot withdraw after the registration deadline" },
        { status: 400 }
      );
    }

    // Can only withdraw pending registrations (not confirmed/attended)
    const registration = await db.registration.findUnique({
      where: { activityId_userEmail: { activityId, userEmail } },
    });
    if (!registration) {
      return NextResponse.json({ error: "Not registered" }, { status: 404 });
    }
    if (registration.status !== "registered") {
      return NextResponse.json(
        { error: "Cannot withdraw a confirmed registration. Please contact the activity manager." },
        { status: 400 }
      );
    }

    await db.registration.delete({
      where: { activityId_userEmail: { activityId, userEmail } },
    });

    return NextResponse.json({ message: "Registration withdrawn" });
  } catch (error) {
    console.error("Withdraw error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
