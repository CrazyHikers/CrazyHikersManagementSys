"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InboundConfig = {
  enabled: boolean;
  active: boolean;
  configured: boolean;
  address: string;
  expiresAt: string | null;
};

function toLocalDateTime(value: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 8 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function InboundSignupSettings() {
  const t = useTranslations("dashboard.settings");
  const [config, setConfig] = useState<InboundConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [eventCode, setEventCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(toLocalDateTime(null));
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/settings/inbound-signup", { cache: "no-store" });
    if (!response.ok) return;
    const nextConfig = (await response.json()) as InboundConfig;
    setConfig(nextConfig);
    setEnabled(nextConfig.enabled);
    setExpiresAt(toLocalDateTime(nextConfig.expiresAt));
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/settings/inbound-signup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          enabled
            ? { enabled, eventCode, expiresAt: new Date(expiresAt).toISOString() }
            : { enabled },
        ),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t("inboundSignupSaveFailed"));
      toast.success(t("saved"));
      setEventCode("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("inboundSignupSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  // The endpoint is dev-only. Admins receive 403 and never see this card.
  if (!config) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">{t("inboundSignupTitle")}</CardTitle>
        <CardDescription>{t("inboundSignupDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="max-w-lg space-y-4">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="size-4"
            />
            {t("inboundSignupEnabled")}
          </label>

          <div className="rounded-md bg-muted p-3 text-sm">
            <div>{t("inboundSignupAddress")}: {config.address || "—"}</div>
            <div>
              {t("inboundSignupStatus")}: {config.active ? t("inboundSignupActive") : t("inboundSignupInactive")}
            </div>
            {!config.configured && (
              <div className="mt-2 text-red-600">{t("inboundSignupNotConfigured")}</div>
            )}
          </div>

          {enabled && (
            <>
              <div className="space-y-1">
                <Label htmlFor="inbound-event-code">{t("inboundSignupEventCode")}</Label>
                <Input
                  id="inbound-event-code"
                  value={eventCode}
                  onChange={(event) => setEventCode(event.target.value.toUpperCase())}
                  pattern="[A-Za-z0-9-]{4,32}"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inbound-expiry">{t("inboundSignupExpiresAt")}</Label>
                <Input
                  id="inbound-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  required
                />
              </div>
            </>
          )}

          <Button type="submit" disabled={saving || (enabled && !config.configured)}>
            {saving ? "..." : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
