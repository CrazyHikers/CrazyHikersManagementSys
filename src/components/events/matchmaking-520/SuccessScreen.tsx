"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  FloatingPetals,
  HeartMountainIcon,
  PlumBlossom,
  fontDisplayZh,
  m520Theme,
} from "./theme";

export function SuccessScreen({ onClose }: { onClose: () => void }) {
  const t = useTranslations("events.matchmaking520.success");
  return (
    <div className="relative overflow-hidden text-center py-14 px-6 space-y-7 rounded-xl bg-[#fdf6ee] dark:bg-stone-900/40 ring-1 ring-[#e8c8c0]/60">
      <FloatingPetals count={7} />

      <div className="relative flex justify-center">
        <HeartMountainIcon className="h-24 w-28 text-[#7a8a6e] m520-bloom" />
      </div>

      <div className="relative flex items-center justify-center gap-3">
        <span className="h-px w-10 bg-[#d4685e]/40" />
        <PlumBlossom className="h-4 w-4 text-[#d4685e]" />
        <span className="h-px w-10 bg-[#d4685e]/40" />
      </div>

      <h2
        className={`${fontDisplayZh} relative text-3xl text-[#3a2820] dark:text-[#fdf6ee]`}
      >
        {t("title")}
      </h2>

      <p className="relative text-[#6a5447] dark:text-[#d4c4b8] max-w-md mx-auto leading-relaxed whitespace-pre-line">
        {t("body")}
      </p>

      <Button onClick={onClose} className={`relative ${m520Theme.gradientCta} px-6`}>
        {t("backHome")}
      </Button>
    </div>
  );
}
