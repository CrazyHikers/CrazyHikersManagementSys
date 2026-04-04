import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getStats() {
  const [openActivities, totalMembers, totalManagers, pendingWaivers] =
    await Promise.all([
      db.activity.count({ where: { status: "open" } }),
      db.member.count(),
      db.manager.count(),
      db.memberWaiver.count({ where: { status: "pending_approval" } }),
    ]);

  return { openActivities, totalMembers, totalManagers, pendingWaivers };
}

export default async function AdminDashboard() {
  const t = await getTranslations("admin.dashboard");
  const stats = await getStats();

  const cards = [
    { label: t("openActivities"), value: stats.openActivities, color: "text-green-600" },
    { label: t("totalMembers"), value: stats.totalMembers, color: "text-blue-600" },
    { label: t("totalManagers"), value: stats.totalManagers, color: "text-purple-600" },
    { label: t("pendingWaivers"), value: stats.pendingWaivers, color: "text-orange-600" },
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
