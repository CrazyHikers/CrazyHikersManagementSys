"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type Manager = {
  email: string;
  name: string;
  managerProfile: { intern: boolean } | null;
};

export function ActivityForm({ managers, currentUserEmail }: { managers: Manager[]; currentUserEmail: string }) {
  const t = useTranslations("dashboard.activities");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedComanagers, setSelectedComanagers] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const coverFile = formData.get("coverImage") as File;
    const qrFile = formData.get("qrCode") as File;

    // Upload files first
    let coverImgId = "";
    let qrCodeUrl = "";

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
        setLoading(false);
        return;
      }
      const { key } = await uploadRes.json();
      coverImgId = key;
    }

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
        setLoading(false);
        return;
      }
      const { url } = await uploadRes.json();
      qrCodeUrl = url;
    }

    // Build hiking metadata (only include fields with values)
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

    const body = {
      title: formData.get("title"),
      description: formData.get("description"),
      coverImgId,
      deadline: formData.get("deadline"),
      date: formData.get("date"),
      capacity: Number(formData.get("capacity")) || 0,
      maximumRegistration: Number(formData.get("maxRegistration")) || 0,
      userEmail: formData.get("userEmail"),
      comanagerEmails: selectedComanagers,
      qrCodeUrl,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create activity");
      }
      const { id } = await res.json();
      toast.success("Activity created!");
      router.push(`/dashboard/activities/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("activityTitle")}</Label>
            <Input id="title" name="title" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" name="description" rows={4} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImage">{t("coverImage")}</Label>
            <Input
              id="coverImage"
              name="coverImage"
              type="file"
              accept="image/*"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">{t("deadline")}</Label>
              <Input id="deadline" name="deadline" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t("activityDate")}</Label>
              <Input id="date" name="date" type="date" required />
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
                defaultValue="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRegistration">{t("maxRegistration")}</Label>
              <Input
                id="maxRegistration"
                name="maxRegistration"
                type="number"
                min="0"
                defaultValue="0"
              />
            </div>
          </div>

          {/* Hiking metadata */}
          <div className="space-y-2">
            <Label htmlFor="route">{t("route")}</Label>
            <Input id="route" name="route" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="distance">{t("distance")}</Label>
              <Input id="distance" name="distance" type="number" min="0" step="0.1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">{t("duration")}</Label>
              <Input id="duration" name="duration" placeholder="e.g. 9 hours" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="elevationGain">{t("elevationGain")}</Label>
              <Input id="elevationGain" name="elevationGain" type="number" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="elevationLoss">{t("elevationLoss")}</Label>
              <Input id="elevationLoss" name="elevationLoss" type="number" min="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="technicalDifficulty">{t("technicalDifficulty")}</Label>
              <select
                id="technicalDifficulty"
                name="technicalDifficulty"
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
            <Textarea id="hikingNotes" name="hikingNotes" rows={2} />
          </div>

          {/* Manager is always the logged-in user */}
          <input type="hidden" name="userEmail" value={currentUserEmail} />

          <div className="space-y-2">
            <Label>{t("comanagers")}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {managers
                .filter((m) => m.email !== currentUserEmail)
                .map((m) => (
                  <label key={m.email} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={m.email}
                      checked={selectedComanagers.includes(m.email)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedComanagers((prev) => [...prev, m.email]);
                        } else {
                          setSelectedComanagers((prev) =>
                            prev.filter((email) => email !== m.email)
                          );
                        }
                      }}
                    />
                    {m.name} {m.managerProfile?.intern ? `(${t("intern")})` : `(${t("qualified")})`}
                  </label>
                ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qrCode">{t("qrCode")}</Label>
            <Input id="qrCode" name="qrCode" type="file" accept="image/*" />
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={loading}
          >
            {loading ? "..." : t("create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
