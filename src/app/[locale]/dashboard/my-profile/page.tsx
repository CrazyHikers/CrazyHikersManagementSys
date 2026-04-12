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
  // Emergency
  emergencyContact?: string;
  emergencyPhone?: string;
  // Personal
  gender?: string;
  organization?: string;
  position?: string;
  // Fitness
  fitnessActivities?: string[];
  fiveKmPace?: string;
  maxElevationGain?: string;
  maxElevationLoss?: string;
  // Equipment
  equipment?: string[];
  // Knowledge Quiz
  quizManagerDuties?: string[];
  quizMemberDuties?: string[];
  // Other
  canDoEquipmentCheck?: boolean;
  navigationSoftware?: string;
  selfIntro?: string;
  insurance?: string[];
  followsCrazyHikers?: boolean;
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
  emergencyContact: "",
  emergencyPhone: "",
  gender: "",
  organization: "",
  position: "",
  fitnessActivities: [],
  fiveKmPace: "",
  maxElevationGain: "",
  maxElevationLoss: "",
  equipment: [],
  quizManagerDuties: [],
  quizMemberDuties: [],
  canDoEquipmentCheck: undefined,
  navigationSoftware: "",
  selfIntro: "",
  insurance: [],
};

const fitnessOptions = ["跑步", "游泳", "骑行", "徒步", "ASVZ有氧", "其他"];
const equipmentOptions = ["登山鞋", "越野跑鞋(非普通跑鞋)", "登山杖", "冲锋衣", "登山包", "户外水袋>1.5L", "魔术头巾", "冰袖"];
const managerDutyOptions = ["导引队伍", "指挥行动", "活跃气氛", "协助背负"];
const memberDutyOptions = ["听从领队指挥", "行前装备检查", "尊重领队劳动", "自我安全意识", "擅自独自行动", "随性穿搭出门", "领队为我服务", "责任全甩领队"];
const insuranceOptions = ["Rega直升机俱乐部", "雇员(公司保险)", "个人额外购买", "以上都没有"];

export default function MyProfilePage() {
  const t = useTranslations("dashboard.myProfile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileConsent, setProfileConsent] = useState(false);
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

  function updateProfileField(field: keyof UserProfile, value: string | string[] | boolean | undefined) {
    setUserProfile((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCheckbox(field: keyof UserProfile, opt: string, checked: boolean) {
    const current = (userProfile[field] as string[] | undefined) || [];
    const updated = checked
      ? [...current, opt]
      : current.filter((x) => x !== opt);
    updateProfileField(field, updated);
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
            {/* Emergency Contact */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("emergencySection")}</h3>
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

            {/* Personal */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("personalSection")}</h3>
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
                      <SelectItem value="男">{t("male")}</SelectItem>
                      <SelectItem value="女">{t("female")}</SelectItem>
                      <SelectItem value="其他">{t("otherGender")}</SelectItem>
                      <SelectItem value="不愿透露">{t("preferNotToSay")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization">{t("organization")}</Label>
                  <Input
                    id="organization"
                    value={userProfile.organization || ""}
                    onChange={(e) => updateProfileField("organization", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">{t("position")}</Label>
                  <Input
                    id="position"
                    value={userProfile.position || ""}
                    onChange={(e) => updateProfileField("position", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Fitness & Experience */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("fitnessSection")}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("fitnessActivities")}</Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {fitnessOptions.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(userProfile.fitnessActivities || []).includes(opt)}
                          onChange={(e) => toggleCheckbox("fitnessActivities", opt, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fiveKmPace">{t("fiveKmPace")}</Label>
                    <Input
                      id="fiveKmPace"
                      value={userProfile.fiveKmPace || ""}
                      onChange={(e) => updateProfileField("fiveKmPace", e.target.value)}
                      placeholder="e.g. 6:30"
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
                </div>
              </div>
            </div>

            {/* Equipment */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("equipmentSection")}</h3>
              <div className="space-y-2">
                <Label>{t("equipment")}</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {equipmentOptions.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(userProfile.equipment || []).includes(opt)}
                        onChange={(e) => toggleCheckbox("equipment", opt, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Knowledge Quiz */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("quizSection")}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("quizManagerDuties")}</Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {managerDutyOptions.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(userProfile.quizManagerDuties || []).includes(opt)}
                          onChange={(e) => toggleCheckbox("quizManagerDuties", opt, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("quizMemberDuties")}</Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {memberDutyOptions.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(userProfile.quizMemberDuties || []).includes(opt)}
                          onChange={(e) => toggleCheckbox("quizMemberDuties", opt, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Other */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t("otherSection")}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("canDoEquipmentCheck")}</Label>
                  <Select
                    value={userProfile.canDoEquipmentCheck === true ? "yes" : userProfile.canDoEquipmentCheck === false ? "no" : ""}
                    onValueChange={(val) => updateProfileField("canDoEquipmentCheck", val === "yes" ? true : val === "no" ? false : undefined)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t("yes")}</SelectItem>
                      <SelectItem value="no">{t("no")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="navigationSoftware">{t("navigationSoftware")}</Label>
                  <Input
                    id="navigationSoftware"
                    value={userProfile.navigationSoftware || ""}
                    onChange={(e) => updateProfileField("navigationSoftware", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selfIntro">{t("selfIntro")}</Label>
                  <Textarea
                    id="selfIntro"
                    rows={3}
                    value={userProfile.selfIntro || ""}
                    onChange={(e) => updateProfileField("selfIntro", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("insurance")}</Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {insuranceOptions.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(userProfile.insurance || []).includes(opt)}
                          onChange={(e) => toggleCheckbox("insurance", opt, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>{t("followsCrazyHikers")}</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="followsCrazyHikers"
                      checked={userProfile.followsCrazyHikers === true}
                      onChange={() => updateProfileField("followsCrazyHikers", true)}
                      className="h-4 w-4"
                    />
                    {t("yes")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="followsCrazyHikers"
                      checked={userProfile.followsCrazyHikers === false}
                      onChange={() => updateProfileField("followsCrazyHikers", false)}
                      className="h-4 w-4"
                    />
                    {t("no")}
                  </label>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={profileConsent}
                onChange={(e) => setProfileConsent(e.target.checked)}
                className="h-4 w-4 mt-0.5"
              />
              <span className="text-muted-foreground">{t("profileConsent")}</span>
            </label>

            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={savingProfile || !profileConsent}
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
