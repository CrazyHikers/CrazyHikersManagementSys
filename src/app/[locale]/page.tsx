import { getTranslations } from "next-intl/server";
import { getPublicUrl } from "@/lib/r2";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ActivityList } from "@/components/activity-list";
import { getRegisterableOpenActivities } from "@/lib/activity";

// Hourly revalidate keeps registration counts at most ~1h stale. Activity
// content edits (create/edit, slug/template, manager accept) still call
// revalidateTag(cacheTags.activities) for immediate refresh; registration
// mutations intentionally do NOT invalidate, since busting the cache on
// every register/withdraw was the dominant CPU cost.
export const revalidate = 3600;

export default async function HomePage() {
  const t = await getTranslations("home");
  const activities = await getRegisterableOpenActivities();

  const activityData = activities.map((activity) => {
    const managerNames = activity.activityManagers
      .filter((am) => am.role === "manager")
      .map((am) => am.user.managerProfile?.tag || am.user.name)
      .join(", ");
    const comanagerNames = activity.activityManagers
      .filter((am) => am.role === "comanager")
      .map((am) => am.user.managerProfile?.tag || am.user.name)
      .join(", ");
    const allNames = [managerNames, comanagerNames]
      .filter(Boolean)
      .join(", ");

    const template =
      activity.metadata && typeof activity.metadata === "object"
        ? (((activity.metadata as Record<string, unknown>).template as
            | string
            | undefined) ?? null)
        : null;

    const thumbnailKey = activity.homepageThumbnailImgId || activity.coverImgId;
    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      coverImgUrl: thumbnailKey ? getPublicUrl(thumbnailKey) : null,
      // unstable_cache serializes Dates to ISO strings; revive and
      // re-emit so the ActivityList client gets a stable ISO format
      // regardless of cache hit/miss.
      date: new Date(activity.date).toISOString(),
      deadline: new Date(activity.deadline).toISOString(),
      capacity: activity.capacity,
      currentRegistrations: activity._count.registrations,
      maximumRegistration: activity.maximumRegistration,
      submissionCount: activity.submissionCount,
      managerNames: allNames,
      template,
    };
  });

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>

          {activityData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {t("noActivities")}
            </div>
          ) : (
            <ActivityList activities={activityData} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
