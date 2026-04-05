import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { WaiverApprovalList } from "@/components/dashboard/waiver-approval";

export default async function WaiversPage() {
  const session = await auth();
  if (!session?.user || !can(session, "waivers.approve")) {
    redirect("/dashboard");
  }
  const t = await getTranslations("dashboard.members");

  const pendingWaivers = await db.userWaiver.findMany({
    where: { status: "pending_approval" },
    include: { user: true },
    orderBy: { signedAt: "desc" },
  });

  const waivers = pendingWaivers.map((w) => ({
    fileId: w.fileId,
    userEmail: w.userEmail,
    userName: w.user.name,
    userEmailDisplay: w.user.email,
    signedAt: w.signedAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("pendingApproval")}</h1>
      <WaiverApprovalList initialWaivers={waivers} />
    </div>
  );
}
