import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RegistrationManager } from "@/components/admin/registration-manager";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin.activities");

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      registrations: {
        include: {
          member: {
            include: {
              registrations: {
                where: { status: "attended" },
                select: { activityId: true },
              },
              waivers: {
                where: { status: "approved" },
                orderBy: { signedAt: "desc" },
                take: 1,
              },
              flags: {
                where: { expiresAt: { gt: new Date() } },
                orderBy: { issuedAt: "desc" },
              },
            },
          },
        },
        orderBy: { registeredAt: "asc" },
      },
    },
  });

  if (!activity) notFound();

  const now = new Date();
  const registrations = activity.registrations
    .filter((r) => {
      // Shadow ban: hide registrations from members with active bans
      const hasActiveBan = r.member.flags.some((f) => f.banUntil > now);
      return !hasActiveBan;
    })
    .map((r) => {
      const activeFlags = r.member.flags;
      const yellowCount = activeFlags.filter((f) => f.flagType === "yellow").length;
      const redCount = activeFlags.filter((f) => f.flagType === "red").length;

      return {
        memberId: r.memberId,
        memberName: r.member.name,
        memberEmail: r.member.email,
        status: r.status,
        registeredAt: r.registeredAt.toISOString(),
        confirmedAt: r.confirmedAt?.toISOString() || null,
        notes: r.notes,
        totalAttended: r.member.registrations.length,
        hasValidWaiver: r.member.waivers.length > 0,
        yellowFlags: yellowCount,
        redFlags: redCount,
        isBanned: false, // filtered out above, but keep for UI consistency
      };
    });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{activity.title}</h1>
      <p className="text-muted-foreground mb-6">{t("registrations")}</p>
      <RegistrationManager
        activityId={activity.id}
        activityStatus={activity.status}
        initialRegistrations={registrations}
      />
    </div>
  );
}
