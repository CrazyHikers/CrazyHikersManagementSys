"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Step1Basic } from "./steps/Step1Basic";
import { Step2Personality } from "./steps/Step2Personality";
import { Step3Background } from "./steps/Step3Background";
import { Step4Intro } from "./steps/Step4Intro";
import { Step5Contact } from "./steps/Step5Contact";
import { SuccessScreen } from "./SuccessScreen";
import { PlumBlossom, fontDisplayZh, m520Theme } from "./theme";
import {
  validateMatchmaking520,
  type Gender,
  type Matchmaking520FormData,
  type Matchmaking520Patch,
} from "@/lib/events/matchmaking-520";

type Props = {
  activityId: string;
  initialName?: string;
  initialGender?: Gender;
  publicUrlFor: (key: string) => string;
  onDone: () => void;
};

const HEADINGS = [
  "step1Heading",
  "step2Heading",
  "step3Heading",
  "step4Heading",
  "step5Heading",
] as const;

export function Matchmaking520Wizard({
  activityId,
  initialName,
  initialGender,
  publicUrlFor,
  onDone,
}: Props) {
  const t = useTranslations("events.matchmaking520.wizard");
  const te = useTranslations("events.matchmaking520.wizard.errors");

  const [step, setStep] = useState(0);
  const [data, setData] = useState<Partial<Matchmaking520FormData>>({
    name: initialName,
    gender: initialGender,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function patch(p: Matchmaking520Patch) {
    setData((prev) => ({ ...prev, ...p }));
  }

  // Local "can advance" checks per step — server-side does authoritative validation.
  // Step 1 (basics) and the final step's contact + consent are the only hard
  // gates; the personality / background / intro steps are all-optional and
  // can be skipped entirely.
  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return (
          !!data.name?.trim() &&
          !!data.gender &&
          !!data.orientation &&
          !!data.birthYearMonth &&
          typeof data.inSwitzerland === "boolean"
        );
      case 1:
      case 2:
      case 3:
        return true;
      case 4:
        return !!data.wechat?.trim() && data.consent === true;
      default:
        return false;
    }
  }

  async function handleSubmit() {
    const result = validateMatchmaking520(data);
    if (!result.ok) {
      toast.error(te("submitFailed"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: result.data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "submitFailed");
      }
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : te("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <SuccessScreen onClose={onDone} />;
  }

  return (
    <Card className={`${m520Theme.cardAccent} shadow-sm relative overflow-hidden`}>
      {/* Decorative corner blossoms */}
      <PlumBlossom
        aria-hidden
        className="absolute -top-3 -left-3 h-12 w-12 text-[#e89898]/25 rotate-12"
      />
      <PlumBlossom
        aria-hidden
        className="absolute -bottom-3 -right-3 h-10 w-10 text-[#e89898]/25 -rotate-12"
      />

      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className={`${fontDisplayZh} text-xl text-[#3a2820] dark:text-[#fdf6ee]`}>
            {t(HEADINGS[step])}
          </span>
          <span className="text-xs tracking-[0.2em] text-[#6a5447] dark:text-[#d4c4b8]">
            {t("stepLabel", { n: step + 1 })}
          </span>
        </CardTitle>

        {/* Blossom-dot step indicator */}
        <div className="flex items-center justify-center gap-2 pt-3">
          {HEADINGS.map((_, i) => {
            const state = i < step ? "complete" : i === step ? "active" : "future";
            return (
              <div key={i} className="flex items-center">
                {state === "active" ? (
                  <PlumBlossom className="h-5 w-5 text-[#d4685e]" />
                ) : state === "complete" ? (
                  <PlumBlossom className="h-4 w-4 text-[#e89898]" />
                ) : (
                  <span className="block h-2 w-2 rounded-full bg-[#e8d8d0] dark:bg-stone-700" />
                )}
                {i < HEADINGS.length - 1 && (
                  <span
                    className={`block h-px w-5 mx-1 ${
                      i < step ? "bg-[#e89898]" : "bg-[#e8d8d0] dark:bg-stone-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {step === 0 && <Step1Basic value={data} onChange={patch} />}
        {step === 1 && <Step2Personality value={data} onChange={patch} />}
        {step === 2 && <Step3Background value={data} onChange={patch} />}
        {step === 3 && <Step4Intro value={data} onChange={patch} />}
        {step === 4 && (
          <Step5Contact
            value={data}
            onChange={patch}
            publicUrlFor={publicUrlFor}
          />
        )}

        <div className="flex justify-between gap-3 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
          >
            {t("prev")}
          </Button>
          {step < 4 ? (
            <Button
              type="button"
              className={m520Theme.gradientCta}
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
            >
              {t("next")}
            </Button>
          ) : (
            <Button
              type="button"
              className={m520Theme.gradientCta}
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
            >
              {submitting ? "…" : t("submit")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
