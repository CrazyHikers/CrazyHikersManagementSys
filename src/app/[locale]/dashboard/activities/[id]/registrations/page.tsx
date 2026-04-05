import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RegistrationManager } from "@/components/dashboard/registration-manager";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("dashboard.activities");

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
      // Shadow ban: hide registrations from users with active bans
      const hasActiveBan = r.user.flags.some((f) => f.banUntil > now);
      return !hasActiveBan;
    })
    .map((r) => {
      const activeFlags = r.user.flags;
      const yellowCount = activeFlags.filter((f) => f.flagType === "yellow").length;
      const redCount = activeFlags.filter((f) => f.flagType === "red").length;

      return {
        userEmail: r.userEmail,
        userName: r.user.name,
        userEmailDisplay: r.user.email,
        status: r.status,
        registeredAt: r.registeredAt.toISOString(),
        confirmedAt: r.confirmedAt?.toISOString() || null,
        notes: r.notes,
        formData: (r as Record<string, unknown>).formData as Record<string, unknown> | null,
        totalAttended: r.user.registrations.length,
        hasValidWaiver: r.user.waivers.length > 0,
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
