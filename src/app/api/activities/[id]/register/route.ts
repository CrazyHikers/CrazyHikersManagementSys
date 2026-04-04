import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const { email, name, notes } = await request.json();

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

    // Create registration — shadow ban is checked at query time
    // (banned users' registrations are hidden from managers, not blocked)
    await db.registration.create({
      data: {
        activityId,
        userEmail: user.email,
        status: "registered",
        notes: notes || null,
      },
    });

    // User always sees success (shadow ban is invisible to them)
    return NextResponse.json({ message: "Registration successful" });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
