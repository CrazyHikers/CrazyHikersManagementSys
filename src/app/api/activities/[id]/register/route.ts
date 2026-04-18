import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isProfileComplete } from "@/lib/profile";
import { findSameDayCommitment, computeEffectiveSubmissionCounts } from "@/lib/activity";

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

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = session.user.email;

    const { id: activityId } = await params;
    const { notes, formData } = await request.json();

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

    // Check max registration. Use the effective count that excludes
    // "phantom" pending registrations from users already confirmed
    // elsewhere on the same day — those rows can never be confirmed, so
    // they should not occupy a slot.
    if (activity.maximumRegistration && activity.maximumRegistration > 0) {
      const counts = await computeEffectiveSubmissionCounts([
        { id: activity.id, date: activity.date },
      ]);
      const count = counts.get(activity.id) ?? 0;
      if (count >= activity.maximumRegistration) {
        return NextResponse.json(
          { error: "Registration is full" },
          { status: 400 }
        );
      }
    }

    // Look up the authenticated user
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for complete profile (including display name)
    if (!user.name?.trim() || !isProfileComplete(user.profile)) {
      return NextResponse.json(
        { error: "INCOMPLETE_PROFILE" },
        { status: 403 }
      );
    }

    // Check for valid (non-expired) waiver
    const validWaiver = await db.userWaiver.findFirst({
      where: { userEmail: user.email, status: "approved" },
    });
    if (!validWaiver) {
      return NextResponse.json(
        { error: "NO_VALID_WAIVER" },
        { status: 403 }
      );
    }

    // Check if user is a manager/comanager of this activity.
    // `confirmed` managers cannot register as members. `invited` co-managers
    // must respond to the invitation first. `declined` rows don't block.
    const activityManager = await db.activityManager.findUnique({
      where: { activityId_userEmail: { activityId, userEmail: user.email } },
    });
    if (activityManager?.status === "confirmed") {
      return NextResponse.json(
        { error: "Activity managers cannot register for their own activity" },
        { status: 400 }
      );
    }
    if (activityManager?.status === "invited") {
      return NextResponse.json(
        { error: "PENDING_COMANAGER_INVITATION" },
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

    // Block registration only if the user already has a confirmed commitment
    // (as a member or as a confirmed manager/comanager) for another activity
    // on the same day. Pending-vs-pending conflicts are allowed — managers
    // decide which one to confirm.
    const conflict = await findSameDayCommitment(user.email, new Date(activity.date), activityId);
    if (conflict) {
      const label = conflict.role === "manager"
        ? `You are already managing "${conflict.title}" on the same day.`
        : `You are already confirmed for "${conflict.title}" on the same day.`;
      return NextResponse.json({ error: label }, { status: 400 });
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
