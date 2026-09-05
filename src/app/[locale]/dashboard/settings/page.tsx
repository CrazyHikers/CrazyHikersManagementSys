"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { WaiverTemplateUpload } from "@/components/dashboard/waiver-template-upload";
import { InboundSignupSettings } from "@/components/dashboard/inbound-signup-settings";

type Setting = {
  id: string;
  key: string;
  value: string;
};

export default function SettingsPage() {
  const t = useTranslations("dashboard.settings");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateValue(id: string, value: string) {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, value } : s))
    );
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) throw new Error("Failed to save settings");

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      <WaiverTemplateUpload />

      <InboundSignupSettings />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("appSettings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("noSettings")}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 max-w-lg">
              {settings.map((setting) => (
                <div key={setting.id} className="space-y-1">
                  <Label htmlFor={setting.id}>
                    {t(setting.key as Parameters<typeof t>[0])}
                  </Label>
                  <Input
                    id={setting.id}
                    value={setting.value}
                    onChange={(e) => updateValue(setting.id, e.target.value)}
                    type="number"
                    min="0"
                  />
                </div>
              ))}
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={saving}
              >
                {saving ? "..." : t("save")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
