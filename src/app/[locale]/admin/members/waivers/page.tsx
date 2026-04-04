import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { WaiverApprovalList } from "@/components/admin/waiver-approval";

export default async function WaiversPage() {
  const t = await getTranslations("admin.members");

  const pendingWaivers = await db.memberWaiver.findMany({
    where: { status: "pending_approval" },
    include: { member: true },
    orderBy: { signedAt: "desc" },
  });

  const waivers = pendingWaivers.map((w) => ({
    fileId: w.fileId,
    memberId: w.memberId,
    memberName: w.member.name,
    memberEmail: w.member.email,
    signedAt: w.signedAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("pendingApproval")}</h1>
      <WaiverApprovalList initialWaivers={waivers} />
    </div>
  );
}
