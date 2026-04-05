"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PromotionRequest } from "@/components/dashboard/promotion-request";

type Profile = {
  email: string;
  name: string;
  role: string;
  tag: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromotionEligibility = any;

const roleBadgeColors: Record<string, string> = {
  dev: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  member: "bg-green-100 text-green-800",
};

export default function MyProfilePage() {
  const t = useTranslations("dashboard.myProfile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [promotionEligibility, setPromotionEligibility] =
    useState<PromotionEligibility | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchPromotionEligibility();
  }, []);

  async function fetchPromotionEligibility() {
    try {
      const res = await fetch("/api/promotions/eligibility");
      if (res.ok) {
        const data = await res.json();
        setPromotionEligibility(data);
      }
    } catch {
      // Silently fail — promotion section just won't show
    }
  }

  async function fetchProfile() {
    try {
      const res = await fetch("/api/users/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setName(data.name);
        setTag(data.tag || "");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag: tag || undefined }),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      const updated = await res.json();
      setProfile(updated);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (!profile) {
    return <div className="text-center py-12 text-muted-foreground">Error loading profile</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-3">
            {t("profileDetails")}
            <Badge className={roleBadgeColors[profile.role] || ""}>
              {profile.role}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {profile.role === "manager" && (
              <div className="space-y-2">
                <Label htmlFor="tag">{t("tag")}</Label>
                <Input
                  id="tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder={t("tagPlaceholder")}
                />
              </div>
            )}
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={saving}
            >
              {saving ? "..." : t("save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {promotionEligibility && (
        <div className="mt-6">
          <PromotionRequest eligibility={promotionEligibility} />
        </div>
      )}
    </div>
  );
}
