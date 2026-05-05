import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
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
import { computeKpi } from "@/lib/kpi";
import { getFlagSettings, unexpiredCutoff } from "@/lib/flags";
import { getDisplayStatus, computeEffectiveSubmissionCounts } from "@/lib/activity";

const flagColors: Record<string, string> = {
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
};

export default async function ManagerDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "managers.list")) {
    redirect("/dashboard");
  }

  const { uid } = await params;

  const user = await db.user.findUnique({
    where: { uid },
    include: { managerProfile: true },
  });

  if (!user || !user.managerProfile) notFound();

  const t = await getTranslations("dashboard.managers");
  const flagSettings = await getFlagSettings();

  const [managedActivities, comanagedActivities, issuedFlags, kpi] =
    await Promise.all([
      db.activityManager.findMany({
        where: {
          userEmail: user.email,
          role: "manager",
          status: "confirmed",
        },
        include: { activity: true },
        orderBy: { activity: { date: "desc" } },
      }),
      db.activityManager.findMany({
        where: {
          userEmail: user.email,
          role: "comanager",
          status: "confirmed",
        },
        include: { activity: true },
        orderBy: { activity: { date: "desc" } },
      }),
      db.userFlag.findMany({
        where: {
          issuedBy: user.email,
          activity: { date: { gt: unexpiredCutoff(flagSettings) } },
        },
        include: { user: true, activity: true },
        orderBy: { activity: { date: "desc" } },
      }),
      computeKpi(user.email),
    ]);

  const submissionMap = await computeEffectiveSubmissionCounts([
    ...managedActivities.map((am) => ({ id: am.activity.id, date: am.activity.date })),
    ...comanagedActivities.map((am) => ({ id: am.activity.id, date: am.activity.date })),
  ]);

  const activityStatusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    open: "bg-blue-100 text-blue-800",
    closed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <Badge
          className={
            user.managerProfile.intern
              ? "bg-yellow-100 text-yellow-800"
              : "bg-green-100 text-green-800"
          }
        >
          {user.managerProfile.intern ? t("intern") : t("qualified")}
        </Badge>
      </div>

      {/* Basic info */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("tag")}: </span>
              <span className="font-medium">{user.managerProfile.tag}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("kpi")}: </span>
              <span className="font-medium">{kpi}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Managed activities */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            {t("managedActivities")} ({managedActivities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {managedActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {t("noManagedActivities")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activity")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managedActivities.map((am) => (
                  <TableRow key={am.activityId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/activity-view/${am.activityId}`}
                        className="hover:underline text-green-700"
                      >
                        {am.activity.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {am.activity.date.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const ds = getDisplayStatus(am.activity, { effectiveSubmissionCount: submissionMap.get(am.activity.id) ?? 0 });
                        return (
                          <Badge className={activityStatusColors[ds] || ""}>
                            {ds}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Co-managed activities */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            {t("comanagedActivities")} ({comanagedActivities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comanagedActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {t("noComanagedActivities")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activity")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comanagedActivities.map((am) => (
                  <TableRow key={am.activityId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/activity-view/${am.activityId}`}
                        className="hover:underline text-green-700"
                      >
                        {am.activity.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {am.activity.date.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const ds = getDisplayStatus(am.activity, { effectiveSubmissionCount: submissionMap.get(am.activity.id) ?? 0 });
                        return (
                          <Badge className={activityStatusColors[ds] || ""}>
                            {ds}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Flags issued */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("issuedFlags")} ({issuedFlags.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {issuedFlags.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {t("noIssuedFlags")}
            </p>
          ) : (
            <div className="space-y-3">
              {issuedFlags.map((f) => (
                <div key={f.id} className={`p-3 rounded-lg ${f.invalidated ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={f.invalidated ? "bg-gray-200 text-gray-500 line-through" : flagColors[f.flagType]}>
                      {f.flagType}
                    </Badge>
                    {f.invalidated && (
                      <Badge variant="outline" className="text-red-600 border-red-300">
                        {t("invalidated")}
                      </Badge>
                    )}
                    <Link href={`/dashboard/members/${f.user.uid}`} prefetch={false} className="text-sm font-medium hover:underline text-green-700">
                      {f.user.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">—</span>
                    <Link href={`/dashboard/activity-view/${f.activityId}`} prefetch={false} className="text-sm text-muted-foreground hover:underline hover:text-green-700">
                      {f.activity.title}
                    </Link>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {f.activity.date.toLocaleDateString()}
                  </div>
                  {f.reason && (
                    <div className="text-sm mt-1">
                      {t("reason")}: {f.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
