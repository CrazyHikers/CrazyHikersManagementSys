"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  FloatingFireflies,
  HangingLantern,
  PavilionLanternIcon,
  aud520Theme,
  fontDisplayAud,
} from "./theme";

export function SuccessScreen({ onClose }: { onClose: () => void }) {
  const t = useTranslations("events.audience520.success");
  return (
    <div className="relative overflow-hidden text-center py-14 px-6 space-y-7 rounded-xl bg-[#fdf6ee] dark:bg-stone-900/40 ring-1 ring-[#c8d4c4]/60">
      <FloatingFireflies count={9} />

      {/* Two side lanterns flanking the icon */}
      <div className="relative flex items-end justify-center gap-8">
        <span className="hidden sm:inline-block aud520-sway origin-top">
          <HangingLantern className="h-14 w-9" />
        </span>
        <PavilionLanternIcon className="h-24 w-28 text-[#5a8a6e] aud520-bloom" />
        <span className="hidden sm:inline-block aud520-sway-slow origin-top">
          <HangingLantern className="h-14 w-9" />
        </span>
      </div>

      <div className="relative flex items-center justify-center gap-3">
        <span className="h-px w-10 bg-[#5a8a6e]/40" />
        <span className="inline-block h-2 w-2 rounded-full bg-[#e8a850]" />
        <span className="h-px w-10 bg-[#5a8a6e]/40" />
      </div>

      <h2
        className={`${fontDisplayAud} relative text-3xl ${aud520Theme.ink}`}
      >
        {t("title")}
      </h2>

      <p className={`relative ${aud520Theme.inkSoft} max-w-md mx-auto leading-relaxed whitespace-pre-line`}>
        {t("body")}
      </p>

      <Button
        onClick={onClose}
        className={`relative ${aud520Theme.gradientCta} px-6`}
      >
        {t("backHome")}
      </Button>
    </div>
  );
}
