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

export function InvalidateFlag({
  flagId,
  userName,
}: {
  flagId: string;
  userName: string;
}) {
  const t = useTranslations("dashboard.flags");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleInvalidate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/flags/${flagId}`, { method: "PATCH" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to invalidate flag");
      }
      toast.success(t("invalidateSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-50" />
        }
      >
        {t("invalidate")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invalidateConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("invalidateConfirmDescription", { name: userName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            onClick={handleInvalidate}
            disabled={loading}
          >
            {loading ? "..." : t("confirmInvalidate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
