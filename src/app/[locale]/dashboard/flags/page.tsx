import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getFlagSettings, computeBanUntil, isBanActive } from "@/lib/flags";
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
import { InvalidateFlag } from "@/components/dashboard/invalidate-flag";

const flagColors: Record<string, string> = {
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
};

export default async function FlagsPage() {
  const session = await auth();
  if (!session?.user || !can(session, "flags.manage")) {
    redirect("/dashboard");
  }

  const t = await getTranslations("dashboard.flags");
  const flagSettings = await getFlagSettings();

  const flags = await db.userFlag.findMany({
    orderBy: { activity: { date: "desc" } },
    include: {
      user: { select: { name: true, uid: true, email: true } },
      activity: { select: { id: true, title: true, date: true } },
      issuer: { select: { name: true } },
      invalidator: { select: { name: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {flags.map((f) => {
          const banActive = !f.invalidated && isBanActive(f, flagSettings);
          return (
            <Card key={f.id} className={f.invalidated ? "opacity-60" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className={flagColors[f.flagType]}>{f.flagType}</Badge>
                  {f.invalidated && (
                    <Badge className="bg-gray-200 text-gray-600">{t("invalidated")}</Badge>
                  )}
                  {banActive && (
                    <Badge className="bg-red-100 text-red-800">{t("banActive")}</Badge>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">{t("member")}: </span>
                    <Link href={`/dashboard/members/${f.user.uid}`} prefetch={false} className="text-green-700 hover:underline">
                      {f.user.name}
                    </Link>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("activity")}: </span>
                    <Link href={`/dashboard/activity-view/${f.activity.id}`} prefetch={false} className="text-green-700 hover:underline">
                      {f.activity.title}
                    </Link>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("issuedBy")}: </span>
                    {f.issuer.name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("issuedAt")}: </span>
                    {f.activity.date.toLocaleDateString()}
                  </div>
                  {f.reason && (
                    <div>
                      <span className="text-muted-foreground">{t("reason")}: </span>
                      {f.reason}
                    </div>
                  )}
                  {banActive && (
                    <div>
                      <span className="text-muted-foreground">{t("banUntil")}: </span>
                      {computeBanUntil(f.activity.date, f.flagType, flagSettings).toLocaleDateString()}
                    </div>
                  )}
                  {f.invalidated && f.invalidator && (
                    <div className="text-orange-600">
                      {t("invalidatedBy")} {f.invalidator.name} {t("on")} {f.invalidatedAt!.toLocaleDateString()}
                    </div>
                  )}
                </div>
                {!f.invalidated && (
                  <div className="mt-3">
                    <InvalidateFlag flagId={f.id} userName={f.user.name} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {flags.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{t("noFlags")}</p>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>{t("allFlags")} ({flags.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noFlags")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("member")}</TableHead>
                  <TableHead>{t("activity")}</TableHead>
                  <TableHead>{t("issuedBy")}</TableHead>
                  <TableHead>{t("issuedAt")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((f) => {
                  const banActive = !f.invalidated && isBanActive(f, flagSettings);
                  return (
                    <TableRow key={f.id} className={f.invalidated ? "opacity-60" : ""}>
                      <TableCell>
                        <Badge className={flagColors[f.flagType]}>{f.flagType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/members/${f.user.uid}`} prefetch={false} className="text-green-700 hover:underline">
                          {f.user.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/activity-view/${f.activity.id}`} prefetch={false} className="text-green-700 hover:underline">
                          {f.activity.title}
                        </Link>
                      </TableCell>
                      <TableCell>{f.issuer.name}</TableCell>
                      <TableCell>{f.activity.date.toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-48 truncate">{f.reason || "—"}</TableCell>
                      <TableCell>
                        {f.invalidated ? (
                          <div>
                            <Badge className="bg-gray-200 text-gray-600">{t("invalidated")}</Badge>
                            {f.invalidator && (
                              <div className="text-xs text-orange-600 mt-1">
                                {f.invalidator.name} · {f.invalidatedAt!.toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : banActive ? (
                          <div>
                            <Badge className="bg-red-100 text-red-800">{t("banActive")}</Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t("until")} {computeBanUntil(f.activity.date, f.flagType, flagSettings).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">{t("expired")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!f.invalidated && (
                          <InvalidateFlag flagId={f.id} userName={f.user.name} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
