import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user || !hasRole(session, "admin")) {
    redirect("/dashboard");
  }
  const t = await getTranslations("dashboard.members");

  const members = await db.user.findMany({
    include: {
      _count: {
        select: {
          registrations: { where: { status: "attended" } },
        },
      },
      waivers: {
        orderBy: { signedAt: "desc" },
        take: 1,
      },
      flags: {
        where: { banUntil: { gt: new Date() } },
        orderBy: { banUntil: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {members.map((m) => (
          <Link key={m.email} href={`/dashboard/members/${encodeURIComponent(m.email)}`}>
            <div className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  <Badge className={
                    m.role === "admin" ? "bg-purple-100 text-purple-800 text-xs" :
                    m.role === "manager" ? "bg-blue-100 text-blue-800 text-xs" :
                    "bg-gray-100 text-gray-800 text-xs"
                  }>
                    {m.role}
                  </Badge>
                  {m.waivers.length > 0 ? (
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      {m.waivers[0].status}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      No waiver
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {t("totalAttended")}: {m._count.registrations}
                {m.flags.length > 0 && (
                  <span className="text-red-600 ml-2">
                    Banned until {m.flags[0].banUntil.toLocaleDateString()}
                  </span>
                )}
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>{t("totalAttended")}</TableHead>
              <TableHead>{t("waiverStatus")}</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.email} className="cursor-pointer hover:bg-gray-50">
                <TableCell>
                  <Link href={`/dashboard/members/${encodeURIComponent(m.email)}`} className="font-medium hover:underline">
                    {m.name}
                  </Link>
                </TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  <Badge className={
                    m.role === "admin" ? "bg-purple-100 text-purple-800" :
                    m.role === "manager" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }>
                    {m.role}
                  </Badge>
                </TableCell>
                <TableCell>{m._count.registrations}</TableCell>
                <TableCell>
                  {m.waivers.length > 0 ? (
                    <Badge className={
                      m.waivers[0].status === "approved" ? "bg-green-100 text-green-800" :
                      m.waivers[0].status === "pending_approval" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }>
                      {m.waivers[0].status}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">None</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {m.flags.length > 0 ? (
                    <Badge className={
                      m.flags[0].flagType === "red"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }>
                      Banned until {m.flags[0].banUntil.toLocaleDateString()}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
