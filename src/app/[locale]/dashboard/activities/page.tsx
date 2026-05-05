import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDisplayStatus, computeEffectiveSubmissionCounts } from "@/lib/activity";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export default async function ActivitiesPage() {
  const t = await getTranslations("dashboard.activities");
  const session = await auth();
  const userEmail = session!.user!.email!;

  // Managers see only their own activities (managed/co-managed)
  const activities = await db.activity.findMany({
    where: {
      activityManagers: {
        some: { userEmail, status: "confirmed" },
      },
    },
    include: {
      activityManagers: {
        where: { status: "confirmed", role: "manager" },
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
    orderBy: { date: "desc" },
  });

  const submissionMap = await computeEffectiveSubmissionCounts(
    activities.map((a) => ({ id: a.id, date: a.date }))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link href="/dashboard/activities/new">
          <Button className="bg-green-600 hover:bg-green-700">
            + {t("create")}
          </Button>
        </Link>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {activities.map((a) => (
          <Link key={a.id} href={`/dashboard/activities/${a.id}`} prefetch={false}>
            <div className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{a.title}</h3>
                {(() => {
                  const ds = getDisplayStatus(a, { effectiveSubmissionCount: submissionMap.get(a.id) ?? 0 });
                  return <Badge className={statusColors[ds]}>{ds}</Badge>;
                })()}
              </div>
              <div className="text-sm text-muted-foreground mt-2 space-y-1">
                <div>{a.date.toLocaleDateString()}</div>
                <div>
                  {a.activityManagers[0]?.user.name || "—"} ·{" "}
                  {t("attendanceCount")}: {a._count.registrations}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("activityTitle")}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{t("activityDate")}</TableHead>
              <TableHead>{t("manager")}</TableHead>
              <TableHead>{t("attendanceCount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((a) => (
              <TableRow key={a.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/dashboard/activities/${a.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.title}
                  </Link>
                </TableCell>
                <TableCell>
                  {(() => {
                  const ds = getDisplayStatus(a, { effectiveSubmissionCount: submissionMap.get(a.id) ?? 0 });
                  return <Badge className={statusColors[ds]}>{ds}</Badge>;
                })()}
                </TableCell>
                <TableCell>{a.date.toLocaleDateString()}</TableCell>
                <TableCell>
                  {a.activityManagers[0]?.user.name || "—"}
                </TableCell>
                <TableCell>
                  {a._count.registrations}
                  {a.maximumRegistration
                    ? ` / ${a.maximumRegistration}`
                    : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
