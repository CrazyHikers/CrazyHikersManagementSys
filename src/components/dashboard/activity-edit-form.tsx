"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type ActivityData = {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO date string
  date: string;
  capacity: number;
  maximumRegistration: number | null;
};

export function ActivityEditForm({
  activity,
  onCancel,
}: {
  activity: ActivityData;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.activities");
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      title: formData.get("title"),
      description: formData.get("description"),
      deadline: new Date(formData.get("deadline") as string + "T23:59:59").toISOString(),
      date: new Date(formData.get("date") as string + "T06:00:00").toISOString(),
      capacity: Number(formData.get("capacity")) || 0,
      maximumRegistration: Number(formData.get("maxRegistration")) || 0,
    };

    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      toast.success("Activity updated");
      router.refresh();
      onCancel();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">{t("editActivity")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("activityTitle")}</Label>
            <Input id="title" name="title" defaultValue={activity.title} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={activity.description}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">{t("deadline")}</Label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                defaultValue={activity.deadline.split("T")[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t("activityDate")}</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={activity.date.split("T")[0]}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">{t("capacity")}</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min="0"
                defaultValue={activity.capacity}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRegistration">{t("maxRegistration")}</Label>
              <Input
                id="maxRegistration"
                name="maxRegistration"
                type="number"
                min="0"
                defaultValue={activity.maximumRegistration || 0}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={saving}
            >
              {saving ? "..." : t("save")}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancelEdit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
