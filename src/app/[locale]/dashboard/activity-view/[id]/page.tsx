import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPublicUrl } from "@/lib/r2";
import { getDisplayStatus, computeEffectiveSubmissionCounts } from "@/lib/activity";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActivityNotificationCard } from "@/components/activity-notification-card";
import { DevActivityControls } from "@/components/dashboard/dev-activity-controls";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const regStatusColors: Record<string, string> = {
  registered: "bg-gray-100 text-gray-800",
  registration_confirmed: "bg-blue-100 text-blue-800",
  attended: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
};

export default async function ActivityViewPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("activity");
  const td = await getTranslations("dashboard.activities");
  const tc = await getTranslations("common");
  const session = await auth();
  const isAdmin = session?.user ? can(session, "members.list") : false;

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: {
        where: { status: "confirmed" },
        include: { user: true },
      },
      registrations: {
        include: { user: true },
        orderBy: { registeredAt: "asc" },
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

  // Dev-only controls. Fetch the distinct set of templates already in
  // use so the dev can pick from a dropdown rather than remembering
  // string values. Lives on this read-only view (which admins/devs can
  // reach for any activity) because the per-activity management page
  // requires being one of that activity's managers.
  const canChangeTemplate = session?.user
    ? can(session, "activities.changeTemplate")
    : false;
  const canEditSlug = session?.user
    ? can(session, "activities.editSlug")
    : false;
  const showDevControls = canChangeTemplate || canEditSlug;
  const metadataObj =
    activity.metadata && typeof activity.metadata === "object"
      ? (activity.metadata as Record<string, unknown>)
      : null;
  const currentTemplate =
    metadataObj && typeof metadataObj.template === "string"
      ? (metadataObj.template as string)
      : null;
  const currentSlug =
    metadataObj && typeof metadataObj.slug === "string"
      ? (metadataObj.slug as string)
      : null;

  const submissionMap = await computeEffectiveSubmissionCounts([
    { id: activity.id, date: activity.date },
  ]);
  const displayStatus = getDisplayStatus(activity, {
    effectiveSubmissionCount: submissionMap.get(activity.id) ?? 0,
  });
  const managers = activity.activityManagers.filter((am) => am.role === "manager");
  const comanagers = activity.activityManagers.filter((am) => am.role === "comanager");

  return (
    <div>
      <div className="flex items-start gap-3 mb-6">
        <h1 className="text-2xl font-bold">{activity.title}</h1>
        <Badge className={statusColors[displayStatus]}>{displayStatus}</Badge>
      </div>

      {showDevControls && (
        <DevActivityControls
          activityId={activity.id}
          currentTemplate={currentTemplate}
          currentSlug={currentSlug}
        />
      )}

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
            <div className="text-sm text-muted-foreground">{t("date")}</div>
            <div className="font-medium">{activity.date.toLocaleDateString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t("deadline")}</div>
            <div className="font-medium">{activity.deadline.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{td("attendanceCount")}</div>
            <div className="font-medium">
              {activity._count.registrations}
              {activity.capacity > 0 && ` / ${activity.capacity}`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{td("maxRegistration")}</div>
            <div className="font-medium">
              {activity.maximumRegistration || t("unlimited")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{t("description")}</CardTitle>
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
              <CardTitle className="text-lg">{t("hikingDetails")}</CardTitle>
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

      <ActivityNotificationCard />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{t("managersCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {managers.map((am) => (
              <div key={am.userEmail} className="flex items-center gap-2">
                <Badge>{td("manager")}</Badge>
                {isAdmin ? (
                  <Link href={`/dashboard/managers/${am.user.uid}`} prefetch={false} className="hover:underline text-green-700">
                    {am.user.name}
                  </Link>
                ) : (
                  <span>{am.user.name}</span>
                )}
                <span className="text-sm text-muted-foreground">({am.user.email})</span>
              </div>
            ))}
            {comanagers.map((am) => (
              <div key={am.userEmail} className="flex items-center gap-2">
                <Badge variant="secondary">{td("comanagers")}</Badge>
                {isAdmin ? (
                  <Link href={`/dashboard/managers/${am.user.uid}`} prefetch={false} className="hover:underline text-green-700">
                    {am.user.name}
                  </Link>
                ) : (
                  <span>{am.user.name}</span>
                )}
                <span className="text-sm text-muted-foreground">({am.user.email})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Participants list — admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("participantsWithCount", {
                count: activity.registrations.length,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.registrations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {t("noParticipants")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tc("name")}</TableHead>
                    <TableHead>{tc("email")}</TableHead>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead>{t("participantRegisteredAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.registrations.map((r) => {
                    const href = `/dashboard/members/${r.user.uid}`;
                    return (
                      <TableRow key={r.userEmail} className="cursor-pointer hover:bg-gray-50">
                        <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2 font-medium">{r.user.name}</Link></TableCell>
                        <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{r.user.email}</Link></TableCell>
                        <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2"><Badge className={regStatusColors[r.status] || ""}>{r.status}</Badge></Link></TableCell>
                        <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{r.registeredAt.toLocaleDateString()}</Link></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
