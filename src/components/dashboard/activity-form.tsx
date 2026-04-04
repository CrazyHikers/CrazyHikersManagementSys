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
      if (uploadRes.ok) {
        const { key } = await uploadRes.json();
        coverImgId = key;
      }
    }

    if (qrFile && qrFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", qrFile);
      uploadData.append("folder", "qrcodes");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });
      if (uploadRes.ok) {
        const { url } = await uploadRes.json();
        qrCodeUrl = url;
      }
    }

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
                    {m.name} {m.managerProfile?.intern ? "(Intern)" : ""}
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
