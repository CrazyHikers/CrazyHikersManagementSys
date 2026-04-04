import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ActivityActions } from "@/components/admin/activity-actions";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin.activities");

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: {
        include: { manager: true },
      },
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["registered", "registration_confirmed"] } },
          },
        },
      },
    },
  });

  if (!activity) notFound();

  const statusColors: Record<string, string> = {
    open: "bg-green-100 text-green-800",
    closed: "bg-yellow-100 text-yellow-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{activity.title}</h1>
          <Badge className={`mt-1 ${statusColors[activity.status]}`}>
            {activity.status}
          </Badge>
        </div>
        {["open", "closed"].includes(activity.status) && (
          <ActivityActions activityId={activity.id} status={activity.status} />
        )}
      </div>

      {activity.coverImgId && (
        <div className="rounded-lg overflow-hidden mb-6 max-h-64">
          <img
            src={getPublicUrl(activity.coverImgId)}
            alt={activity.title}
            className="w-full object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t("activityDate")}</div>
            <div className="font-medium">{activity.date.toLocaleDateString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t("deadline")}</div>
            <div className="font-medium">{activity.deadline.toLocaleDateString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t("registrations")}</div>
            <div className="font-medium">
              {activity._count.registrations}
              {activity.maximumRegistration ? ` / ${activity.maximumRegistration}` : ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t("capacity")}</div>
            <div className="font-medium">{activity.capacity || "Unlimited"}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("description")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{activity.description}</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("manager")} / {t("comanagers")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activity.activityManagers.map((am) => (
              <div key={am.managerId} className="flex items-center gap-2">
                <Badge variant={am.role === "manager" ? "default" : "secondary"}>
                  {am.role}
                </Badge>
                <span>{am.manager.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({am.manager.email})
                </span>
                {am.status !== "confirmed" && (
                  <Badge variant="outline">{am.status}</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {["open", "closed"].includes(activity.status) && (
        <Link href={`/admin/activities/${activity.id}/registrations`}>
          <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
            {t("registrations")}
          </Button>
        </Link>
      )}
    </div>
  );
}
