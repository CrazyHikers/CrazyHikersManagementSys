import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getUserRole, can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getManagerStats() {
  const [openActivities, totalMembers, totalManagers, expiringWaivers] =
    await Promise.all([
      db.activity.count({ where: { status: "open" } }),
      db.user.count({ where: { role: "member" } }),
      db.user.count({ where: { role: { in: ["manager", "admin", "dev"] } } }),
      db.userWaiver.count({ where: { status: "expiring" } }),
    ]);

  return { openActivities, totalMembers, totalManagers, expiringWaivers };
}

async function getMemberStats(email: string) {
  const now = new Date();
  const [upcomingCount, waiverStatus] = await Promise.all([
    db.registration.count({
      where: {
        userEmail: email,
        status: { in: ["registration_confirmed", "attended"] },
        activity: { date: { gte: now } },
      },
    }),
    db.userWaiver.findFirst({
      where: { userEmail: email, status: { in: ["approved", "expiring"] } },
      orderBy: { signedAt: "desc" },
    }),
  ]);

  return { upcomingCount, hasValidWaiver: !!waiverStatus };
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session!.user as any;
  const role = getUserRole(session!);

  if (role === "member") {
    const stats = await getMemberStats(user.email);
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("upcomingActivities")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.upcomingCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("waiverStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.hasValidWaiver ? (
                <Badge className="bg-green-100 text-green-800">Approved</Badge>
              ) : (
                <Badge variant="destructive">Not submitted</Badge>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Manager / Admin view
  const stats = await getManagerStats();
  const isAdmin = can(session!, "waivers.approve");
  const cards = [
    { label: t("openActivities"), value: stats.openActivities, color: "text-green-600" },
    { label: t("totalMembers"), value: stats.totalMembers, color: "text-blue-600" },
    { label: t("totalManagers"), value: stats.totalManagers, color: "text-purple-600" },
    ...(isAdmin
      ? [{ label: t("expiringWaivers"), value: stats.expiringWaivers, color: "text-orange-600" }]
      : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${card.color}`}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
