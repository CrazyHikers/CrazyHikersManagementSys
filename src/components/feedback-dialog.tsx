"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

type FeedbackType = "bug" | "feature" | "other";

export function FeedbackDialog() {
  const { data: session } = useSession();
  const t = useTranslations("feedback");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!session?.user) return null;

  function reset() {
    setType("bug");
    setTitle("");
    setDescription("");
  }

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          locale,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          toast.error(t("tooManyRequests"));
        } else {
          toast.error(t("error"));
        }
        return;
      }
      toast.success(t("success"));
      setOpen(false);
      reset();
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="hover:text-foreground hover:underline text-left"
          />
        }
      >
        {t("button")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("systemOnly")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{t("typeLabel")}</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              {(["bug", "feature", "other"] as const).map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="feedback-type"
                    value={opt}
                    checked={type === opt}
                    onChange={() => setType(opt)}
                  />
                  {t(`type_${opt}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedback-title">{t("titleLabel")}</Label>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              maxLength={120}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedback-description">
              {t("descriptionLabel")}
            </Label>
            <Textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              maxLength={4000}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !description.trim() || loading}
          >
            {loading ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
