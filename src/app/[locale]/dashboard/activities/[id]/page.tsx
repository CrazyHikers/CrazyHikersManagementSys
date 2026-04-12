import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ActivityActions } from "@/components/dashboard/activity-actions";
import { EditButton } from "@/components/dashboard/activity-detail-client";
import { ShareButton } from "@/components/share-button";
import { InviteComanager } from "@/components/dashboard/invite-comanager";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations("dashboard.activities");

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: {
        include: { user: true },
      },
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["registration_confirmed", "attended"] } },
          },
        },
      },
    },
  });

  if (!activity) notFound();

  const isEditable = ["open", "closed"].includes(activity.status);
  const existingEmails = new Set(activity.activityManagers.map((am) => am.userEmail));

  // Fetch available managers for co-manager invitations
  const allManagers = isEditable
    ? await db.user.findMany({
        where: { role: { in: ["manager", "admin", "dev"] } },
        include: { managerProfile: true },
        orderBy: { name: "asc" },
      })
    : [];
  const availableManagers = allManagers
    .filter((m) => !existingEmails.has(m.email))
    .map((m) => ({
      email: m.email,
      name: m.name,
      intern: m.managerProfile?.intern ?? false,
    }));

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
        <div className="flex gap-2 flex-wrap items-start">
          {activity.status === "open" && (
            <ShareButton path={`/${locale}/activities/${activity.id}`} />
          )}
            <EditButton
              activity={{
                id: activity.id,
                title: activity.title,
                description: activity.description,
                deadline: activity.deadline.toISOString(),
                date: activity.date.toISOString(),
                capacity: activity.capacity,
                maximumRegistration: activity.maximumRegistration,
                coverImgId: activity.coverImgId,
                metadata: activity.metadata as Record<string, unknown> | null,
              }}
            />
            <ActivityActions activityId={activity.id} status={activity.status} />
        </div>
        )}
      </div>

      {activity.coverImgId && (
        <div className="rounded-lg overflow-hidden mb-6 max-h-64 bg-gray-100">
          <img
            src={getPublicUrl(activity.coverImgId)}
            alt={activity.title}
            className="w-full h-full max-h-64 object-contain"
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

      {/* Hiking Details */}
      {activity.metadata && typeof activity.metadata === "object" && Object.keys(activity.metadata as object).length > 0 && (() => {
        const meta = activity.metadata as Record<string, unknown>;
        const stars = (n: unknown) => typeof n === "number" ? "★".repeat(n) + "☆".repeat(5 - n) : "";
        const has = (key: string) => meta[key] != null && meta[key] !== "";
        return (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("hikingDetails")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {has("route") ? (
                  <div>
                    <div className="text-sm text-muted-foreground">{t("route")}</div>
                    <div className="font-medium">{String(meta.route)}</div>
                  </div>
                ) : null}
                {has("distance") ? (
                  <div>
                    <div className="text-sm text-muted-foreground">{t("distance")}</div>
                    <div className="font-medium">{Number(meta.distance)} km</div>
                  </div>
                ) : null}
                {has("elevationGain") ? (
                  <div>
                    <div className="text-sm text-muted-foreground">{t("elevationGain")}</div>
                    <div className="font-medium">{Number(meta.elevationGain)} m</div>
                  </div>
                ) : null}
                {has("elevationLoss") ? (
                  <div>
                    <div className="text-sm text-muted-foreground">{t("elevationLoss")}</div>
                    <div className="font-medium">{Number(meta.elevationLoss)} m</div>
                  </div>
                ) : null}
                {has("duration") ? (
                  <div>
                    <div className="text-sm text-muted-foreground">{t("duration")}</div>
                    <div className="font-medium">{String(meta.duration)}</div>
                  </div>
                ) : null}
                {has("technicalDifficulty") ? (
                  <div>
                    <div className="text-sm text-muted-foreground">{t("technicalDifficulty")}</div>
                    <div className="font-medium">{stars(meta.technicalDifficulty)}</div>
                  </div>
                ) : null}
                {has("enduranceDifficulty") ? (
                  <div>
                    <div className="text-sm text-muted-foreground">{t("enduranceDifficulty")}</div>
                    <div className="font-medium">{stars(meta.enduranceDifficulty)}</div>
                  </div>
                ) : null}
                {has("notes") ? (
                  <div className="sm:col-span-2">
                    <div className="text-sm text-muted-foreground">{t("hikingNotes")}</div>
                    <div className="font-medium whitespace-pre-wrap">{String(meta.notes)}</div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("manager")} / {t("comanagers")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activity.activityManagers.map((am) => (
              <div key={am.userEmail} className="flex items-center gap-2">
                <Badge variant={am.role === "manager" ? "default" : "secondary"}>
                  {am.role === "manager" ? t("manager") : t("comanagers")}
                </Badge>
                <span>{am.user.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({am.user.email})
                </span>
                {am.status !== "confirmed" && (
                  <Badge variant="outline">
                    {am.status === "invited" ? t("invited") : am.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
          {isEditable && (
            <div className="mt-4">
              <InviteComanager activityId={activity.id} availableManagers={availableManagers} />
            </div>
          )}
        </CardContent>
      </Card>

      {(() => {
        const qrCodeUrl = (activity.metadata as Record<string, unknown> | null)?.qrCodeUrl as string | undefined;
        if (!qrCodeUrl) return null;
        return (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("qrCode")}</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={qrCodeUrl}
                alt={t("qrCode")}
                className="max-w-64 rounded-lg"
              />
            </CardContent>
          </Card>
        );
      })()}

      {["open", "closed"].includes(activity.status) && (
        <Link href={`/dashboard/activities/${activity.id}/registrations`}>
          <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
            {t("registrations")}
          </Button>
        </Link>
      )}
    </div>
  );
}
