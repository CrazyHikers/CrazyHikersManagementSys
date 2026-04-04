"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ActivityActions({
  activityId,
  status,
}: {
  activityId: string;
  status: string;
}) {
  const t = useTranslations("dashboard.activities");
  const router = useRouter();

  async function handleAction(action: "close" | "finish" | "cancel") {
    const newStatus =
      action === "close" ? "closed" : action === "finish" ? "completed" : "cancelled";

    const res = await fetch(`/api/activities/${activityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      toast.success(`Activity ${action}d`);
      router.refresh();
    } else {
      toast.error("Failed");
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {status === "open" && (
        <Button variant="outline" size="sm" onClick={() => handleAction("close")}>
          {t("closeRegistration")}
        </Button>
      )}
      <Button
        size="sm"
        className="bg-green-600 hover:bg-green-700"
        onClick={() => handleAction("finish")}
      >
        {t("finishActivity")}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => handleAction("cancel")}
      >
        {t("cancelActivity")}
      </Button>
    </div>
  );
}
