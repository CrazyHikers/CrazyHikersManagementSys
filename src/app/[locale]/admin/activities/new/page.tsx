import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { ActivityForm } from "@/components/admin/activity-form";

export default async function CreateActivityPage() {
  const t = await getTranslations("admin.activities");

  // Get available managers for selection
  const managers = await db.manager.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("create")}</h1>
      <ActivityForm managers={managers} />
    </div>
  );
}
