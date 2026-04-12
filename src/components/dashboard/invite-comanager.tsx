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

type AvailableManager = {
  email: string;
  name: string;
  intern: boolean;
};

export function InviteComanager({
  activityId,
  availableManagers,
}: {
  activityId: string;
  availableManagers: AvailableManager[];
}) {
  const t = useTranslations("dashboard.activities");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInvite() {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/comanagers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selected }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to invite");
      }
      toast.success(t("inviteSuccess"));
      setOpen(false);
      setSelected("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (availableManagers.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(""); }}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50" />
        }
      >
        + {t("inviteComanager")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inviteComanagerTitle")}</DialogTitle>
          <DialogDescription>
            {t("inviteComanagerDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableManagers.map((m) => (
            <label
              key={m.email}
              className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded ${
                selected === m.email ? "bg-green-50 border border-green-200" : "hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="comanager"
                value={m.email}
                checked={selected === m.email}
                onChange={() => setSelected(m.email)}
              />
              {m.name}
              <span className="text-muted-foreground">
                ({m.intern ? t("intern") : t("qualified")})
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancelAction")}
          </DialogClose>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleInvite}
            disabled={!selected || loading}
          >
            {loading ? "..." : t("invite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
