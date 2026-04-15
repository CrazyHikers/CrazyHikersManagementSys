"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function ActivityActions({
  activityId,
  hasConfirmedMembers,
}: {
  activityId: string;
  hasConfirmedMembers: boolean;
}) {
  const t = useTranslations("dashboard.activities");
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function handleAction(newStatus: string) {
    setProcessing(true);
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(
        newStatus === "completed" ? t("activityFinished") : t("activityCancelled")
      );
      router.refresh();
    } catch {
      toast.error("Failed");
    } finally {
      setProcessing(false);
      setFinishOpen(false);
      setCancelOpen(false);
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogTrigger
          render={
            <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={!hasConfirmedMembers} />
          }
        >
          {t("finishActivity")}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("finishConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("finishConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("cancelAction")}
            </DialogClose>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleAction("completed")}
              disabled={processing}
            >
              {processing ? "..." : t("confirmFinish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogTrigger
          render={
            <Button variant="destructive" size="sm" />
          }
        >
          {t("cancelActivity")}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("cancelConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("cancelAction")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => handleAction("cancelled")}
              disabled={processing}
            >
              {processing ? "..." : t("confirmCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
