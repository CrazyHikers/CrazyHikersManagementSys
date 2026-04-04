import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Find or create member
    let member = await db.member.findUnique({ where: { email } });
    if (!member) {
      member = await db.member.create({
        data: { name, email },
      });
    }

    // Check if already registered
    const existing = await db.registration.findUnique({
      where: {
        activityId_memberId: { activityId, memberId: member.id },
      },
    });
    if (existing) {
      if (notes) {
        await db.registration.update({
          where: {
            activityId_memberId: { activityId, memberId: member.id },
          },
          data: { notes: existing.notes ? `${existing.notes}\n${notes}` : notes },
        });
      }
      return NextResponse.json({ message: "Already registered" });
    }

    // Create registration — if member is shadow-banned, this still succeeds
    // (the ban is checked at query time when managers view registrations)
    await db.registration.create({
      data: {
        activityId,
        memberId: member.id,
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
