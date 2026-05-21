import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cacheTags } from "@/lib/cache-tags";

// Dev-only: set/clear `Activity.metadata.slug` from the dashboard.
// Slugs feed `/events/<slug>` and must be unique across activities —
// uniqueness is enforced here at write time. There is no database
// constraint on metadata path fields, so this check is the source of
// truth; the `/events/<slug>` reader applies a deterministic
// tiebreaker just in case legacy data violates the invariant.
//
// Body: { slug: string | null }   // null clears the field

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session, "activities.editSlug")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.slug;
  let slug: string | null;
  if (raw === null) {
    slug = null;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") {
      slug = null;
    } else if (trimmed.length > 64) {
      return NextResponse.json(
        { error: "Slug too long (max 64 chars)" },
        { status: 400 }
      );
    } else if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
      return NextResponse.json(
        { error: "Slug must contain only letters, digits, _ and -" },
        { status: 400 }
      );
    } else {
      slug = trimmed;
    }
  } else {
    return NextResponse.json(
      { error: "Slug must be a string or null" },
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
  const oldSlug =
    typeof existing.slug === "string" ? existing.slug : null;

  // Uniqueness check: if assigning a slug, refuse if any OTHER activity
  // already has it. Same-activity reassignment (no change) silently
  // passes — the user gets the success path without an update.
  if (slug !== null && slug !== oldSlug) {
    const conflict = await db.activity.findFirst({
      where: {
        id: { not: id },
        metadata: { path: ["slug"], equals: slug },
      },
      select: { id: true, title: true },
    });
    if (conflict) {
      return NextResponse.json(
        {
          error: `Slug "${slug}" is already used by another activity: ${conflict.title}`,
          conflictActivityId: conflict.id,
        },
        { status: 409 }
      );
    }
  }

  const next: Record<string, unknown> = { ...existing };
  if (slug === null) {
    delete next.slug;
  } else {
    next.slug = slug;
  }

  await db.activity.update({
    where: { id },
    data: { metadata: next as Prisma.InputJsonValue },
  });

  // expire: 0 so the next /events/<slug> visit sees the new mapping
  // immediately — "max" would serve the stale (often null → 404) value
  // while the background refetch runs.
  revalidateTag(cacheTags.activity(id), { expire: 0 });
  revalidateTag(cacheTags.activities, { expire: 0 });

  return NextResponse.json({
    oldSlug,
    newSlug: slug,
  });
}
