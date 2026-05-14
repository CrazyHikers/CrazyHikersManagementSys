import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { cacheTags } from "@/lib/cache-tags";

// Resolves Activity.metadata.slug → activity.id, then redirects to the
// canonical /activities/<id> URL. The activity detail page handles the
// rest (including any template-specific landing layout).
//
// Uniqueness is enforced at write time by the PATCH /api/activities/
// [id]/slug endpoint. The reader still picks deterministically if
// legacy data somehow violates the invariant: prefer activities that
// are currently `open`, then by date closest to now (preferring future
// over past), then by most-recently-updated.
function findActivityIdBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const matches = await db.activity.findMany({
        where: { metadata: { path: ["slug"], equals: slug } },
        select: {
          id: true,
          status: true,
          date: true,
          updatedAt: true,
          title: true,
        },
      });
      if (matches.length === 0) return null;
      if (matches.length === 1) return matches[0].id;

      console.warn(
        `[events/${slug}] slug is shared by ${matches.length} activities; ` +
          `tiebreak resolving to one. Activities: ` +
          matches.map((m) => `${m.id} (${m.title})`).join(", ")
      );

      const now = Date.now();
      const sorted = [...matches].sort((a, b) => {
        // 1. Prefer status === "open"
        const aOpen = a.status === "open" ? 0 : 1;
        const bOpen = b.status === "open" ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        // 2. Prefer future dates over past, then by closeness to now
        const aDist = a.date.getTime() - now;
        const bDist = b.date.getTime() - now;
        const aFuture = aDist >= 0 ? 0 : 1;
        const bFuture = bDist >= 0 ? 0 : 1;
        if (aFuture !== bFuture) return aFuture - bFuture;
        if (Math.abs(aDist) !== Math.abs(bDist)) {
          return Math.abs(aDist) - Math.abs(bDist);
        }
        // 3. Most recently updated wins
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      return sorted[0].id;
    },
    ["event-slug", slug],
    { tags: [cacheTags.activities], revalidate: 3600 }
  )();
}

export default async function EventBySlugPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const id = await findActivityIdBySlug(slug);
  if (!id) notFound();
  redirect(`/${locale}/activities/${id}`);
}
