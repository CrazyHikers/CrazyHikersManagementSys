import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ManagersPage() {
  const t = await getTranslations("admin.managers");

  const managers = await db.manager.findMany({
    include: {
      _count: {
        select: {
          activityManagers: {
            where: {
              status: "confirmed",
              activity: { status: { in: ["open", "closed"] } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {managers.map((m) => (
          <div key={m.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-muted-foreground">{m.email}</div>
              </div>
              <Badge
                className={
                  m.intern
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-green-100 text-green-800"
                }
              >
                {m.intern ? t("intern") : t("qualified")}
              </Badge>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground mt-2">
              <span>{t("tag")}: {m.tag}</span>
              <span>{t("kpi")}: {m.kpi}</span>
              <span>
                {t("currentActivities")}: {m._count.activityManagers}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>{t("tag")}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{t("kpi")}</TableHead>
              <TableHead>{t("currentActivities")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.tag}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      m.intern
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }
                  >
                    {m.intern ? t("intern") : t("qualified")}
                  </Badge>
                </TableCell>
                <TableCell>{m.kpi}</TableCell>
                <TableCell>{m._count.activityManagers}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
