import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getFlagSettings, unexpiredCutoff, isBanActive } from "@/lib/flags";
import { getPublicUrl } from "@/lib/r2";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditButton } from "@/components/dashboard/activity-detail-client";
import { ShareButton } from "@/components/share-button";
import { InviteComanager } from "@/components/dashboard/invite-comanager";
import { RegistrationManager } from "@/components/dashboard/registration-manager";
import { RegistrationsStore } from "@/components/dashboard/registrations-store";
import { RegistrationCountDisplay } from "@/components/dashboard/registration-count-display";
import { getDisplayStatus, computeEffectiveSubmissionCounts } from "@/lib/activity";
import { ActivityNotificationCard } from "@/components/activity-notification-card";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations("dashboard.activities");
  const session = await auth();
  const canViewMemberDetail = session?.user ? can(session, "members.viewDetail") : false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerIsIntern = (session?.user as any)?.isIntern === true;
  const flagSettings = await getFlagSettings();

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: {
        include: { user: true },
      },
      registrations: {
        include: {
          proposals: true,
          user: {
            include: {
              registrations: {
                include: { activity: { select: { id: true, title: true, date: true } } },
                orderBy: { registeredAt: "desc" },
              },
              waivers: {
                where: { status: "approved" },
                orderBy: { signedAt: "desc" },
                take: 1,
                select: { status: true, signedName: true },
              },
              flags: {
                where: { activity: { date: { gt: unexpiredCutoff(flagSettings) } }, invalidated: false },
                orderBy: { activity: { date: "desc" } },
                include: { activity: true, issuer: true },
              },
            },
          },
        },
        orderBy: { registeredAt: "asc" },
      },
    },
  });

  if (!activity) notFound();

  const isEditable = activity.status === "open";
  const submissionMap = await computeEffectiveSubmissionCounts([
    { id: activity.id, date: activity.date },
  ]);
  const displayStatus = getDisplayStatus(activity, {
    effectiveSubmissionCount: submissionMap.get(activity.id) ?? 0,
  });
  const existingEmails = new Set(activity.activityManagers.map((am) => am.userEmail));

  // Build the registration list for the RegistrationManager. Filter out
  // shadow-banned pending registrations and sort so confirmed/attended/absent
  // land on top; still-pending `registered` rows sink to the bottom.
  const now = new Date();
  const viewerEmail = session?.user?.email ?? null;
  const registrations = activity.registrations
    .filter((r) => {
      if (r.status !== "registered") return true;
      const hasActiveBan = r.user.flags.some((f) => isBanActive(f, flagSettings, now));
      return !hasActiveBan;
    })
    .map((r) => {
      const activeFlags = r.user.flags;
      const yellowCount = activeFlags.filter((f) => f.flagType === "yellow").length;
      const redCount = activeFlags.filter((f) => f.flagType === "red").length;
      const proposalCount = r.proposals.length;
      const viewerProposed = viewerEmail
        ? r.proposals.some((p) => p.proposerEmail === viewerEmail)
        : false;

      return {
        userEmail: r.userEmail,
        userUid: r.user.uid,
        userName: r.user.name,
        userEmailDisplay: r.user.email,
        status: r.status,
        registeredAt: r.registeredAt.toISOString(),
        confirmedAt: r.confirmedAt?.toISOString() || null,
        notes: r.notes,
        formData: r.formData ? JSON.parse(JSON.stringify(r.formData)) : null,
        userProfile: r.user.profile ? JSON.parse(JSON.stringify(r.user.profile)) : null,
        totalAttended: r.user.registrations.filter((reg) => reg.status === "attended").length,
        hasValidWaiver: r.user.waivers.length > 0,
        waiverSignedName: r.user.waivers[0]?.signedName || null,
        yellowFlags: yellowCount,
        redFlags: redCount,
        flagHistory: activeFlags.map((f) => ({
          flagType: f.flagType,
          reason: f.reason,
          activityDate: f.activity.date.toISOString(),
          activityTitle: f.activity.title,
          issuerName: f.issuer.name,
        })),
        isBanned: false,
        pendingFlag: r.pendingFlag || null,
        pendingFlagReason: r.pendingFlagReason || null,
        proposalCount,
        viewerProposed,
        activityHistory: r.user.registrations
          .filter((reg) => reg.activityId !== id)
          .map((reg) => ({
            activityId: reg.activityId,
            activityTitle: reg.activity.title,
            activityDate: reg.activity.date.toISOString(),
            status: reg.status,
          })),
      };
    })
    .sort((a, b) => {
      const statusOrder: Record<string, number> = {
        registration_confirmed: 0,
        attended: 1,
        absent: 2,
        registered: 3,
      };
      const aRank = statusOrder[a.status] ?? 99;
      const bRank = statusOrder[b.status] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
    });

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
    <RegistrationsStore initialRegistrations={registrations}>
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold">{activity.title}</h1>
          <Badge className={`${statusColors[displayStatus]}`}>
            {displayStatus}
          </Badge>
        </div>
        {isEditable && (
        <div className="flex gap-2 flex-wrap items-center">
          {displayStatus === "open" && (
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
            <div className="text-sm text-muted-foreground">{t("attendanceCount")}</div>
            <div className="font-medium">
              <RegistrationCountDisplay maximumRegistration={activity.maximumRegistration} />
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

      {isEditable && (
        <RegistrationManager
          activityId={activity.id}
          activityStatus={activity.status}
          canViewMemberDetail={canViewMemberDetail}
          capacity={activity.capacity}
          viewerIsIntern={viewerIsIntern}
        />
      )}
    </div>
    </RegistrationsStore>
  );
}
