import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cacheTags } from "@/lib/cache-tags";
import { canEditActivityRecap, parseActivityRecap } from "@/lib/activity-recap";
import { headObject } from "@/lib/r2";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const activity = await db.activity.findUnique({
    where: { id },
    select: { metadata: true, status: true, updatedAt: true, activityManagers: { select: { userEmail: true, status: true, role: true } } },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditActivityRecap(session.user, activity.activityManagers)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (activity.status !== "completed") return NextResponse.json({ error: "Activity must be completed" }, { status: 409 });
  const body = await request.json().catch(() => null);
  const recap = parseActivityRecap(body, id);
  if (!recap) return NextResponse.json({ error: "Invalid recap" }, { status: 400 });
  if (body.version !== activity.updatedAt.toISOString()) return NextResponse.json({ error: "Activity changed. Reload before editing." }, { status: 409 });
  const photos = await Promise.all(recap.photoKeys.map(headObject));
  if (photos.some((photo) => !photo || !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(photo.contentType))) {
    return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
  }
  const metadata = activity.metadata && typeof activity.metadata === "object" && !Array.isArray(activity.metadata) ? activity.metadata : {};
  // Optimistic locking prevents simultaneous recap/general edits from losing metadata.
  const saved = await db.$transaction(async (tx) => {
    const result = await tx.activity.updateMany({
      where: { id, status: "completed", updatedAt: activity.updatedAt },
      data: { metadata: { ...metadata, recap: { description: recap.description, photoKeys: recap.photoKeys } } },
    });
    if (!result.count) return false;
    if (recap.albumUrl) {
      await tx.activityAlbum.upsert({ where: { activityId: id }, create: { activityId: id, url: recap.albumUrl }, update: { url: recap.albumUrl } });
    } else {
      await tx.activityAlbum.deleteMany({ where: { activityId: id } });
    }
    return true;
  });
  if (!saved) return NextResponse.json({ error: "Activity changed. Reload before editing." }, { status: 409 });
  revalidateTag(cacheTags.activity(id), { expire: 0 });
  revalidateTag(cacheTags.activities, { expire: 0 });
  return NextResponse.json({ success: true });
}
