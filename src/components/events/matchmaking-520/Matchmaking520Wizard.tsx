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
import { m520Theme } from "./theme";
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
        return (
          !!data.constellation?.trim() &&
          !!data.mbti?.trim() &&
          typeof data.heightCm === "number" &&
          typeof data.weightKg === "number"
        );
      case 2:
        return (
          !!data.hometown?.trim() &&
          !!data.school?.trim() &&
          !!data.major?.trim() &&
          !!data.stage &&
          !!data.currentCity?.trim()
        );
      case 3:
        return (
          !!data.hobbies?.trim() &&
          !!data.selfIntro?.trim() &&
          !!data.expectations?.trim() &&
          (data.interestedActivities?.length ?? 0) > 0
        );
      case 4:
        return (
          !!data.wechat?.trim() &&
          !!data.photoKey &&
          data.consent === true
        );
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
    <Card className={`${m520Theme.cardAccent} ${m520Theme.cardAccentDark}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t(HEADINGS[step])}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {t("stepLabel", { n: step + 1 })}
          </span>
        </CardTitle>
        <div className="flex gap-1.5 pt-2">
          {HEADINGS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < step
                  ? m520Theme.stepDotComplete
                  : i === step
                    ? m520Theme.stepDotActive
                    : m520Theme.stepDotInactive
              }`}
            />
          ))}
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
              className={`${m520Theme.gradientCta} text-white`}
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
            >
              {t("next")}
            </Button>
          ) : (
            <Button
              type="button"
              className={`${m520Theme.gradientCta} text-white`}
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
