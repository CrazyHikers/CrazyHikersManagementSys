import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getFlagSettings, unexpiredCutoff, isBanActive } from "@/lib/flags";
import { RegistrationManager } from "@/components/dashboard/registration-manager";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("dashboard.activities");
  const flagSettings = await getFlagSettings();

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      registrations: {
        include: {
          user: {
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
                where: { issuedAt: { gt: unexpiredCutoff(flagSettings) } },
                orderBy: { issuedAt: "desc" },
                include: { activity: true, issuer: true },
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
      // Shadow ban: hide registrations from users with active bans
      const hasActiveBan = r.user.flags.some((f) => isBanActive(f, flagSettings, now));
      return !hasActiveBan;
    })
    .map((r) => {
      const activeFlags = r.user.flags;
      const yellowCount = activeFlags.filter((f) => f.flagType === "yellow").length;
      const redCount = activeFlags.filter((f) => f.flagType === "red").length;

      return {
        userEmail: r.userEmail,
        userUid: r.user.uid,
        userName: r.user.name,
        userEmailDisplay: r.user.email,
        status: r.status,
        registeredAt: r.registeredAt.toISOString(),
        confirmedAt: r.confirmedAt?.toISOString() || null,
        notes: r.notes,
        formData: r.formData ? JSON.parse(JSON.stringify(r.formData)) : null,
        userProfile: r.user.profile ? JSON.parse(JSON.stringify(r.user.profile)) : null,
        totalAttended: r.user.registrations.length,
        hasValidWaiver: r.user.waivers.length > 0,
        yellowFlags: yellowCount,
        redFlags: redCount,
        flagHistory: activeFlags.map((f) => ({
          flagType: f.flagType,
          reason: f.reason,
          issuedAt: f.issuedAt.toISOString(),
          activityTitle: f.activity.title,
          issuerName: f.issuer.name,
        })),
        isBanned: false, // filtered out above, but keep for UI consistency
        pendingFlag: r.pendingFlag || null,
        pendingFlagReason: r.pendingFlagReason || null,
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
