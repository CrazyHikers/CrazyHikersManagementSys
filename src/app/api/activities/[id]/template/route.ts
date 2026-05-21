import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cacheTags } from "@/lib/cache-tags";
import { isKnownTemplate } from "@/lib/events/templates";

// Dev-only: set/clear `Activity.metadata.template` so we can flip an
// activity into a bespoke landing template (e.g. matchmaking_520) from
// the dashboard without touching the database directly. The template
// string is stored verbatim — landing-page branching in the activity
// detail route is what assigns meaning to specific values.
//
// Body: { template: string | null }   // null clears the field

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "activities.changeTemplate")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { template?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.template;
  let template: string | null;
  if (raw === null) {
    template = null;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") {
      template = null;
    } else if (!isKnownTemplate(trimmed)) {
      return NextResponse.json(
        {
          error: `Unknown template "${trimmed}". Register it in src/lib/events/templates.ts first.`,
        },
        { status: 400 }
      );
    } else {
      template = trimmed;
    }
  } else {
    return NextResponse.json(
      { error: "Template must be a string or null" },
      { status: 400 }
    );
  }

  const activity = await db.activity.findUnique({
    where: { id },
    select: { metadata: true },
  });
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const existing =
    activity.metadata && typeof activity.metadata === "object"
      ? (activity.metadata as Record<string, unknown>)
      : {};
  const oldTemplate =
    typeof existing.template === "string" ? existing.template : null;

  const next: Record<string, unknown> = { ...existing };
  if (template === null) {
    delete next.template;
  } else {
    next.template = template;
  }

  await db.activity.update({
    where: { id },
    data: { metadata: next as Prisma.InputJsonValue },
  });

  // expire: 0 for read-your-own-writes: managers expect the new template
  // to render on the very next visit, not after a background refresh.
  revalidateTag(cacheTags.activity(id), { expire: 0 });
  revalidateTag(cacheTags.activities, { expire: 0 });

  return NextResponse.json({
    oldTemplate,
    newTemplate: template,
  });
}
