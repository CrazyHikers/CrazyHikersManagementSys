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

export default async function MembersPage() {
  const t = await getTranslations("admin.members");

  const members = await db.member.findMany({
    include: {
      _count: {
        select: {
          registrations: { where: { status: "attended" } },
        },
      },
      waivers: {
        where: { status: "approved" },
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
          <div key={m.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-muted-foreground">{m.email}</div>
              </div>
              <div className="flex gap-1">
                {m.waivers.length > 0 ? (
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    Waiver OK
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    No waiver
                  </Badge>
                )}
                {m.flags.length > 0 && (
                  <Badge
                    className={`text-xs ${
                      m.flags[0].flagType === "red"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    Banned until{" "}
                    {m.flags[0].banUntil.toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {t("totalAttended")}: {m._count.registrations}
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
              <TableHead>{t("totalAttended")}</TableHead>
              <TableHead>{t("waiverStatus")}</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m._count.registrations}</TableCell>
                <TableCell>
                  {m.waivers.length > 0 ? (
                    <Badge className="bg-green-100 text-green-800">
                      Approved
                    </Badge>
                  ) : (
                    <Badge variant="destructive">None</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {m.flags.length > 0 ? (
                    <Badge
                      className={
                        m.flags[0].flagType === "red"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
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
