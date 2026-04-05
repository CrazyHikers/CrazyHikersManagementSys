"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PromotionRequest } from "@/components/dashboard/promotion-request";

type UserProfile = {
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  gender?: string;
  nationality?: string;
  city?: string;
  fitnessLevel?: string;
  maxElevationGain?: string;
  maxElevationLoss?: string;
  transportPreference?: string;
  regionPreference?: string;
  equipment?: string;
  medicalConditions?: string;
  socialMedia?: string;
  travelCard?: string;
};

type Profile = {
  email: string;
  name: string;
  role: string;
  tag: string | null;
  profile?: UserProfile;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromotionEligibility = any;

const roleBadgeColors: Record<string, string> = {
  dev: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  member: "bg-green-100 text-green-800",
};

const emptyUserProfile: UserProfile = {
  phone: "",
  emergencyContact: "",
  emergencyPhone: "",
  gender: "",
  nationality: "",
  city: "",
  fitnessLevel: "",
  maxElevationGain: "",
  maxElevationLoss: "",
  transportPreference: "",
  regionPreference: "",
  equipment: "",
  medicalConditions: "",
  socialMedia: "",
  travelCard: "",
};

export default function MyProfilePage() {
  const t = useTranslations("dashboard.myProfile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile>(emptyUserProfile);
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
        if (data.profile) {
          setUserProfile({ ...emptyUserProfile, ...data.profile });
        }
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

  function updateProfileField(field: keyof UserProfile, value: string) {
    setUserProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag: tag || undefined, profile: userProfile }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      const updated = await res.json();
      setProfile(updated);
      toast.success(t("personalDetailsSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingProfile(false);
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
            {["manager", "admin", "dev"].includes(profile.role) && (
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">{t("personalDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Personal */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("personal")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">{t("gender")}</Label>
                  <Select
                    value={userProfile.gender || ""}
                    onValueChange={(val) => updateProfileField("gender", val || "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectGender")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("male")}</SelectItem>
                      <SelectItem value="female">{t("female")}</SelectItem>
                      <SelectItem value="other">{t("otherGender")}</SelectItem>
                      <SelectItem value="prefer_not_to_say">{t("preferNotToSay")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">{t("nationality")}</Label>
                  <Input
                    id="nationality"
                    value={userProfile.nationality || ""}
                    onChange={(e) => updateProfileField("nationality", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t("city")}</Label>
                  <Input
                    id="city"
                    value={userProfile.city || ""}
                    onChange={(e) => updateProfileField("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input
                    id="phone"
                    value={userProfile.phone || ""}
                    onChange={(e) => updateProfileField("phone", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("emergency")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">{t("emergencyContact")}</Label>
                  <Input
                    id="emergencyContact"
                    value={userProfile.emergencyContact || ""}
                    onChange={(e) => updateProfileField("emergencyContact", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">{t("emergencyPhone")}</Label>
                  <Input
                    id="emergencyPhone"
                    value={userProfile.emergencyPhone || ""}
                    onChange={(e) => updateProfileField("emergencyPhone", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Hiking */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("hiking")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fitnessLevel">{t("fitnessLevel")}</Label>
                  <Input
                    id="fitnessLevel"
                    value={userProfile.fitnessLevel || ""}
                    onChange={(e) => updateProfileField("fitnessLevel", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxElevationGain">{t("maxElevationGain")}</Label>
                  <Input
                    id="maxElevationGain"
                    type="number"
                    min="0"
                    value={userProfile.maxElevationGain || ""}
                    onChange={(e) => updateProfileField("maxElevationGain", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxElevationLoss">{t("maxElevationLoss")}</Label>
                  <Input
                    id="maxElevationLoss"
                    type="number"
                    min="0"
                    value={userProfile.maxElevationLoss || ""}
                    onChange={(e) => updateProfileField("maxElevationLoss", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transportPreference">{t("transportPreference")}</Label>
                  <Input
                    id="transportPreference"
                    value={userProfile.transportPreference || ""}
                    onChange={(e) => updateProfileField("transportPreference", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regionPreference">{t("regionPreference")}</Label>
                  <Input
                    id="regionPreference"
                    value={userProfile.regionPreference || ""}
                    onChange={(e) => updateProfileField("regionPreference", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label htmlFor="equipment">{t("equipment")}</Label>
                <Textarea
                  id="equipment"
                  rows={2}
                  value={userProfile.equipment || ""}
                  onChange={(e) => updateProfileField("equipment", e.target.value)}
                />
              </div>
            </div>

            {/* Medical */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("medical")}</h3>
              <div className="space-y-2">
                <Label htmlFor="medicalConditions">{t("medicalConditions")}</Label>
                <Textarea
                  id="medicalConditions"
                  rows={2}
                  value={userProfile.medicalConditions || ""}
                  onChange={(e) => updateProfileField("medicalConditions", e.target.value)}
                />
              </div>
            </div>

            {/* Other */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("other")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="socialMedia">{t("socialMedia")}</Label>
                  <Input
                    id="socialMedia"
                    value={userProfile.socialMedia || ""}
                    onChange={(e) => updateProfileField("socialMedia", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="travelCard">{t("travelCard")}</Label>
                  <Input
                    id="travelCard"
                    value={userProfile.travelCard || ""}
                    onChange={(e) => updateProfileField("travelCard", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={savingProfile}
            >
              {savingProfile ? "..." : t("save")}
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
