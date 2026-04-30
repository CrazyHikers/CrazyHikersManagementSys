import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getFlagSettings, banActiveCutoff, isBanActive, computeBanUntil } from "@/lib/flags";
import { MembersTable, type MemberRow } from "@/components/dashboard/members-table";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user || !can(session, "members.list")) {
    redirect("/dashboard");
  }
  const t = await getTranslations("dashboard.members");
  const flagSettings = await getFlagSettings();

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
        where: { issuedAt: { gt: banActiveCutoff(flagSettings) }, invalidated: false },
        orderBy: { issuedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const memberRows: MemberRow[] = members.map((m) => {
    const activeBan = m.flags.find((f) => isBanActive(f, flagSettings));
    return {
      uid: m.uid,
      email: m.email,
      name: m.name,
      role: m.role,
      totalAttended: m._count.registrations,
      waiverStatus: m.waivers[0]?.status ?? null,
      banUntil: activeBan
        ? computeBanUntil(activeBan.issuedAt, activeBan.flagType, flagSettings).toISOString()
        : null,
      banFlagType: activeBan ? (activeBan.flagType as "yellow" | "red") : null,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
      <MembersTable members={memberRows} />
    </div>
  );
}
