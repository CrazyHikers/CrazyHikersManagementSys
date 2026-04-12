import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
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
  const upcoming = registrations.filter(
    (r) => r.activity.date >= now && !["completed", "cancelled"].includes(r.activity.status)
  );
  const past = registrations.filter(
    (r) => r.activity.date < now || ["completed", "cancelled"].includes(r.activity.status)
  );

  function renderGroup(items: typeof registrations) {
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
                <div className="flex items-start gap-3">
                  {r.activity.coverImgId && (
                    <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                      <img
                        src={getPublicUrl(r.activity.coverImgId)}
                        alt={r.activity.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.activity.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {r.activity.date.toLocaleDateString()}
                      </span>
                      <Badge className={statusColors[r.status] || ""}>
                        {statusLabels[r.status] || r.status}
                      </Badge>
                    </div>
                  </div>
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
      {renderGroup(upcoming)}

      <h2 className="text-lg font-semibold mt-8 mb-3">{t("past")}</h2>
      {renderGroup(past)}
    </div>
  );
}
