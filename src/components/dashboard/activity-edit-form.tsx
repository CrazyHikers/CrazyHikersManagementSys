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

type ActivityMetadata = {
  route?: string;
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
  duration?: string;
  technicalDifficulty?: number;
  enduranceDifficulty?: number;
  notes?: string;
};

type ActivityMetadataFull = ActivityMetadata & {
  qrCodeUrl?: string;
};

type ActivityData = {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO date string
  date: string;
  capacity: number;
  maximumRegistration: number | null;
  coverImgId: string;
  metadata?: ActivityMetadataFull | null;
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
    const coverFile = formData.get("coverImage") as File;
    const qrFile = formData.get("qrCode") as File;

    // Upload cover image if a new one is selected
    let coverImgId = activity.coverImgId;
    if (coverFile && coverFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", coverFile);
      uploadData.append("folder", "covers");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        toast.error(err.error || "Cover image upload failed");
        setSaving(false);
        return;
      }
      const { key } = await uploadRes.json();
      coverImgId = key;
    }

    // Upload QR code if a new one is selected
    let qrCodeUrl = activity.metadata?.qrCodeUrl || "";
    if (qrFile && qrFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", qrFile);
      uploadData.append("folder", "qrcodes");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        toast.error(err.error || "QR code upload failed");
        setSaving(false);
        return;
      }
      const { url } = await uploadRes.json();
      qrCodeUrl = url;
    }

    // Build hiking metadata
    const metadata: Record<string, unknown> = {};
    const route = formData.get("route") as string;
    const distance = formData.get("distance") as string;
    const elevationGain = formData.get("elevationGain") as string;
    const elevationLoss = formData.get("elevationLoss") as string;
    const duration = formData.get("duration") as string;
    const technicalDifficulty = formData.get("technicalDifficulty") as string;
    const enduranceDifficulty = formData.get("enduranceDifficulty") as string;
    const hikingNotes = formData.get("hikingNotes") as string;

    if (route) metadata.route = route;
    if (distance) metadata.distance = Number(distance);
    if (elevationGain) metadata.elevationGain = Number(elevationGain);
    if (elevationLoss) metadata.elevationLoss = Number(elevationLoss);
    if (duration) metadata.duration = duration;
    if (technicalDifficulty) metadata.technicalDifficulty = Number(technicalDifficulty);
    if (enduranceDifficulty) metadata.enduranceDifficulty = Number(enduranceDifficulty);
    if (hikingNotes) metadata.notes = hikingNotes;

    // Preserve qrCodeUrl in metadata
    if (qrCodeUrl) metadata.qrCodeUrl = qrCodeUrl;

    const body = {
      title: formData.get("title"),
      description: formData.get("description"),
      coverImgId,
      deadline: new Date(formData.get("deadline") as string + "T23:59:59").toISOString(),
      date: new Date(formData.get("date") as string + "T06:00:00").toISOString(),
      capacity: Number(formData.get("capacity")) || 0,
      maximumRegistration: Number(formData.get("maxRegistration")) || 0,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
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

          <div className="space-y-2">
            <Label htmlFor="coverImage">{t("coverImage")}</Label>
            {activity.coverImgId && (
              <p className="text-xs text-muted-foreground">{t("currentImageKept")}</p>
            )}
            <Input id="coverImage" name="coverImage" type="file" accept="image/*" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qrCode">{t("qrCode")}</Label>
            {activity.metadata?.qrCodeUrl && (
              <p className="text-xs text-muted-foreground">{t("currentImageKept")}</p>
            )}
            <Input id="qrCode" name="qrCode" type="file" accept="image/*" />
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

          {/* Hiking metadata */}
          <div className="space-y-2">
            <Label htmlFor="route">{t("route")}</Label>
            <Input id="route" name="route" defaultValue={activity.metadata?.route || ""} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="distance">{t("distance")}</Label>
              <Input id="distance" name="distance" type="number" min="0" step="0.1" defaultValue={activity.metadata?.distance || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">{t("duration")}</Label>
              <Input id="duration" name="duration" defaultValue={activity.metadata?.duration || ""} placeholder="e.g. 9 hours" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="elevationGain">{t("elevationGain")}</Label>
              <Input id="elevationGain" name="elevationGain" type="number" min="0" defaultValue={activity.metadata?.elevationGain || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="elevationLoss">{t("elevationLoss")}</Label>
              <Input id="elevationLoss" name="elevationLoss" type="number" min="0" defaultValue={activity.metadata?.elevationLoss || ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="technicalDifficulty">{t("technicalDifficulty")}</Label>
              <select
                id="technicalDifficulty"
                name="technicalDifficulty"
                defaultValue={activity.metadata?.technicalDifficulty || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">--</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enduranceDifficulty">{t("enduranceDifficulty")}</Label>
              <select
                id="enduranceDifficulty"
                name="enduranceDifficulty"
                defaultValue={activity.metadata?.enduranceDifficulty || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">--</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hikingNotes">{t("hikingNotes")}</Label>
            <Textarea id="hikingNotes" name="hikingNotes" rows={2} defaultValue={activity.metadata?.notes || ""} />
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
