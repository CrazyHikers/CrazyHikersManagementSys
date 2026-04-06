import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { WaiverAuditLog } from "@/components/dashboard/waiver-approval";

export default async function WaiversPage() {
  const session = await auth();
  if (!session?.user || !can(session, "waivers.approve")) {
    redirect("/dashboard");
  }
  const t = await getTranslations("dashboard.members");

  const allWaivers = await db.userWaiver.findMany({
    include: { user: true },
    orderBy: { signedAt: "desc" },
    take: 100,
  });

  const waivers = allWaivers.map((w) => ({
    fileId: w.fileId,
    userEmail: w.userEmail,
    userName: w.user.name,
    userEmailDisplay: w.user.email,
    signedAt: w.signedAt.toISOString(),
    status: w.status,
    signedVersion: w.signedVersion,
    signedName: w.signedName,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("waiverHistory")}</h1>
      <WaiverAuditLog waivers={waivers} />
    </div>
  );
}
