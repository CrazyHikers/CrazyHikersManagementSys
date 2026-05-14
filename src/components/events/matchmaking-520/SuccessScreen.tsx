"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { HeartMountainIcon, m520Theme } from "./theme";

export function SuccessScreen({ onClose }: { onClose: () => void }) {
  const t = useTranslations("events.matchmaking520.success");
  return (
    <div className="text-center py-10 px-4 space-y-6">
      <div className="flex justify-center">
        <HeartMountainIcon className="h-20 w-20 animate-pulse" />
      </div>
      <h2 className="text-2xl font-bold">{t("title")}</h2>
      <p className="text-muted-foreground max-w-md mx-auto whitespace-pre-line">
        {t("body")}
      </p>
      <Button
        onClick={onClose}
        className={`${m520Theme.gradientCta} text-white`}
      >
        {t("backHome")}
      </Button>
    </div>
  );
}
