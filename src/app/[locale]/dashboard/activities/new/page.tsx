import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActivityForm } from "@/components/dashboard/activity-form";

export default async function CreateActivityPage() {
  const t = await getTranslations("dashboard.activities");
  const session = await auth();
  const currentUserEmail = session!.user!.email!;

  // Get available managers/admins for comanager selection
  const managers = await db.user.findMany({
    where: { role: { in: ["manager", "admin", "dev"] } },
    include: { managerProfile: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("create")}</h1>
      <ActivityForm managers={managers} currentUserEmail={currentUserEmail} />
    </div>
  );
}
