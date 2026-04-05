import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { ActivityCard } from "@/components/activity-card";

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

  // Filter out activities at max registration
  return activities.filter((a) => {
    if (!a.maximumRegistration || a.maximumRegistration === 0) return true;
    return a._count.registrations < a.maximumRegistration;
  });
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const session = await auth();
  const activities = await getOpenActivities();

  return (
    <>
      <SiteHeader user={session?.user ?? null} />
      <main className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {t("noActivities")}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {activities.map((activity) => {
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

                return (
                  <ActivityCard
                    key={activity.id}
                    id={activity.id}
                    title={activity.title}
                    description={activity.description}
                    coverImgUrl={
                      activity.coverImgId
                        ? getPublicUrl(activity.coverImgId)
                        : null
                    }
                    date={activity.date.toISOString()}
                    deadline={activity.deadline.toISOString()}
                    capacity={activity.capacity}
                    currentRegistrations={activity._count.registrations}
                    managerNames={allNames}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
