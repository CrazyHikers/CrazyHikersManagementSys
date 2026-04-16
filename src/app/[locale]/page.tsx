import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ActivityList } from "@/components/activity-list";

export const revalidate = 300; // ISR: regenerate every 5 minutes

async function getOpenActivities() {
  const now = new Date();
  const activities = await db.activity.findMany({
    where: {
      status: "open",
      deadline: { gt: now },
    },
    include: {
      activityManagers: {
        where: { status: "confirmed" },
        include: { user: { include: { managerProfile: true } } },
      },
      _count: {
        select: {
          registrations: {
            where: {
              status: { in: ["registration_confirmed", "attended"] },
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Second count: "forms submitted" = registered + registration_confirmed.
  // This matches the cap the registration API enforces (see
  // /api/activities/[id]/register/route.ts) and is a separate count from
  // the existing `_count.registrations` which tracks confirmed spots only.
  const submissionCounts = await db.registration.groupBy({
    by: ["activityId"],
    where: {
      activityId: { in: activities.map((a) => a.id) },
      status: { in: ["registered", "registration_confirmed"] },
    },
    _count: { _all: true },
  });
  const submissionMap = new Map(
    submissionCounts.map((c) => [c.activityId, c._count._all])
  );

  // Filter out activities at max registration
  return activities
    .filter((a) => {
      if (!a.maximumRegistration || a.maximumRegistration === 0) return true;
      return (submissionMap.get(a.id) ?? 0) < a.maximumRegistration;
    })
    .map((a) => ({ ...a, submissionCount: submissionMap.get(a.id) ?? 0 }));
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const activities = await getOpenActivities();

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

    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      coverImgUrl: activity.coverImgId
        ? getPublicUrl(activity.coverImgId)
        : null,
      date: activity.date.toISOString(),
      deadline: activity.deadline.toISOString(),
      capacity: activity.capacity,
      currentRegistrations: activity._count.registrations,
      maximumRegistration: activity.maximumRegistration,
      submissionCount: activity.submissionCount,
      managerNames: allNames,
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
