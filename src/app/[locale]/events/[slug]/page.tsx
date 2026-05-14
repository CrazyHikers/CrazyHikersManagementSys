import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { cacheTags } from "@/lib/cache-tags";

// Resolves Activity.metadata.slug → activity.id, then redirects to the
// canonical /activities/<id> URL. The activity detail page handles the
// rest (including any template-specific landing layout).
function findActivityIdBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const found = await db.activity.findFirst({
        where: { metadata: { path: ["slug"], equals: slug } },
        select: { id: true },
      });
      return found?.id ?? null;
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
