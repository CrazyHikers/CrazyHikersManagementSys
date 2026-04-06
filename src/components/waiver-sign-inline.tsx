"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const WAIVER_VERSION = 2;

export function WaiverSignInline({
  onSigned,
  validityDays,
}: {
  onSigned: () => void;
  validityDays: number;
}) {
  const t = useTranslations("dashboard.myWaivers");
  const [agreed, setAgreed] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [signing, setSigning] = useState(false);

  async function handleSign() {
    setSigning(true);
    try {
      const res = await fetch("/api/users/me/waivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "esign", version: WAIVER_VERSION, signedName: legalName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to sign waiver");
      toast.success(t("signSuccess"));
      onSigned();
    } catch {
      toast.error(t("signError"));
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <iframe
            src="/waiver-template.pdf"
            className="w-full border-0"
            style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}
            title={t("title")}
          />
        </CardContent>
      </Card>

      <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        {t("validityInfo", { days: validityDays })}
      </div>

      <div className="space-y-1">
        <Label htmlFor="legal-name" className="text-sm font-medium">
          {t("legalNameLabel")}
        </Label>
        <Input
          id="legal-name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder={t("legalNamePlaceholder")}
          required
        />
        <p className="text-xs text-muted-foreground">{t("legalNameHint")}</p>
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="waiver-agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="waiver-agree" className="text-sm font-normal leading-snug">
          {t("agreeText")}
        </Label>
      </div>

      <Button
        onClick={handleSign}
        disabled={!agreed || !legalName.trim() || signing}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {signing ? "..." : t("signButton")}
      </Button>
    </div>
  );
}
