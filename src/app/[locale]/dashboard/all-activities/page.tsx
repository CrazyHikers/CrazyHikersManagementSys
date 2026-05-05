import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
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

export default async function AllActivitiesPage() {
  const session = await auth();
  if (!session?.user || !can(session, "activities.viewAll")) {
    redirect("/dashboard");
  }

  const t = await getTranslations("dashboard.activities");
  const activities = await db.activity.findMany({
    include: {
      activityManagers: {
        where: { status: "confirmed" },
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
      <h1 className="text-2xl font-bold mb-6">{t("allActivities")}</h1>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {activities.map((a) => {
          const mainManager = a.activityManagers.find((am) => am.role === "manager");
          const comanagers = a.activityManagers.filter((am) => am.role === "comanager");
          return (
            <div key={a.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/dashboard/activity-view/${a.id}`} prefetch={false} className="font-medium hover:underline text-green-700">{a.title}</Link>
                {(() => {
                    const ds = getDisplayStatus(a, { effectiveSubmissionCount: submissionMap.get(a.id) ?? 0 });
                    return <Badge className={statusColors[ds]}>{ds}</Badge>;
                  })()}
              </div>
              <div className="text-sm text-muted-foreground mt-2 space-y-1">
                <div>{a.date.toLocaleDateString()}</div>
                <div>
                  {mainManager?.user.name || "—"}
                  {comanagers.length > 0 && (
                    <span className="text-xs"> + {comanagers.map((c) => c.user.name).join(", ")}</span>
                  )}
                </div>
                <div>{t("attendanceCount")}: {a._count.registrations}</div>
              </div>
            </div>
          );
        })}
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
              <TableHead>{t("comanagers")}</TableHead>
              <TableHead>{t("attendanceCount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((a) => {
              const mainManager = a.activityManagers.find((am) => am.role === "manager");
              const comanagers = a.activityManagers.filter((am) => am.role === "comanager");
              return (
                <TableRow key={a.id} className="cursor-pointer hover:bg-gray-50">
                  {(() => {
                    const href = `/dashboard/activity-view/${a.id}`;
                    const ds = getDisplayStatus(a, { effectiveSubmissionCount: submissionMap.get(a.id) ?? 0 });
                    return (<>
                      <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2 font-medium">{a.title}</Link></TableCell>
                      <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2"><Badge className={statusColors[ds]}>{ds}</Badge></Link></TableCell>
                      <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{a.date.toLocaleDateString()}</Link></TableCell>
                      <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{mainManager?.user.name || "—"}</Link></TableCell>
                      <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{comanagers.length > 0 ? comanagers.map((c) => c.user.name).join(", ") : "—"}</Link></TableCell>
                      <TableCell className="p-0"><Link href={href} prefetch={false} className="block px-4 py-2">{a._count.registrations}{a.maximumRegistration ? ` / ${a.maximumRegistration}` : ""}</Link></TableCell>
                    </>);
                  })()}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
