import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

const statusColors: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800",
  registration_confirmed: "bg-green-100 text-green-800",
  attended: "bg-emerald-100 text-emerald-800",
  absent: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  registered: "Registered",
  registration_confirmed: "Confirmed",
  attended: "Attended",
  absent: "Absent",
};

export default async function MyActivitiesPage() {
  const t = await getTranslations("dashboard.myActivities");
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const email = (session!.user as any).email as string;

  const registrations = await db.registration.findMany({
    where: { userEmail: email },
    include: { activity: true },
    orderBy: { activity: { date: "desc" } },
  });

  const now = new Date();
  const upcoming = registrations.filter((r) => r.activity.date >= now);
  const past = registrations.filter((r) => r.activity.date < now);

  function renderGroup(title: string, items: typeof registrations) {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {t("noActivities")}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((r) => (
          <Link key={r.activityId} href={`/activities/${r.activityId}`}>
            <Card className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{r.activity.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {r.activity.date.toLocaleDateString()}
                    </div>
                  </div>
                  <Badge className={statusColors[r.status] || ""}>
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      <h2 className="text-lg font-semibold mb-3">{t("upcoming")}</h2>
      {renderGroup(t("upcoming"), upcoming)}

      <h2 className="text-lg font-semibold mt-8 mb-3">{t("past")}</h2>
      {renderGroup(t("past"), past)}
    </div>
  );
}
