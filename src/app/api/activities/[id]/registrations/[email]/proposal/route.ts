import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canProposeRegistration } from "@/lib/permissions";

// POST and DELETE are both idempotent — clicking Propose twice or
// Withdraw twice in a row both resolve to "no-op success" rather than
// surfacing a duplicate / not-found error to the user.

async function loadAuthorizedContext(
  params: Promise<{ id: string; email: string }>
) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canProposeRegistration(session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const { id: activityId, email: rawEmail } = await params;
  const userEmail = decodeURIComponent(rawEmail);
  const proposerEmail = session.user.email!;

  // The target registration must exist and still be pending — proposing
  // for a confirmed/attended/absent member is meaningless.
  const registration = await db.registration.findUnique({
    where: { activityId_userEmail: { activityId, userEmail } },
  });
  if (!registration) {
    return { error: NextResponse.json({ error: "Registration not found" }, { status: 404 }) };
  }
  if (registration.status !== "registered") {
    return {
      error: NextResponse.json(
        { error: "Cannot propose a registration that is no longer pending" },
        { status: 409 }
      ),
    };
  }

  return { session, activityId, userEmail, proposerEmail };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; email: string }> }
) {
  const ctx = await loadAuthorizedContext(params);
  if ("error" in ctx) return ctx.error;
  const { activityId, userEmail, proposerEmail } = ctx;

  // Upsert keeps the call idempotent: a double-click by the same intern
  // is a no-op rather than a 409.
  await db.registrationProposal.upsert({
    where: {
      activityId_userEmail_proposerEmail: { activityId, userEmail, proposerEmail },
    },
    update: {},
    create: { activityId, userEmail, proposerEmail },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; email: string }> }
) {
  const ctx = await loadAuthorizedContext(params);
  if ("error" in ctx) return ctx.error;
  const { activityId, userEmail, proposerEmail } = ctx;

  // deleteMany over delete so a missing row resolves to 0 instead of P2025.
  await db.registrationProposal.deleteMany({
    where: { activityId, userEmail, proposerEmail },
  });

  return NextResponse.json({ success: true });
}
