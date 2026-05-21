"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  validateAudience520,
  type Audience520FormData,
  type Audience520Patch,
} from "@/lib/events/audience-520";
import { GENDER_VALUES, type Gender } from "@/lib/events/matchmaking-520";
import {
  HangingLantern,
  aud520Theme,
  fontDisplayAud,
} from "./theme";

type Props = {
  activityId: string;
  initialName?: string;
  initialGender?: Gender;
  onDone: () => void;
};

export function Audience520Form({
  activityId,
  initialName,
  initialGender,
  onDone,
}: Props) {
  const tf = useTranslations("events.audience520.form.fields");
  const to = useTranslations("events.audience520.form.options");
  const tyn = useTranslations("events.audience520.form.yesNo");
  const ta = useTranslations("events.audience520.form");
  const te = useTranslations("events.audience520.form.errors");

  const [data, setData] = useState<Partial<Audience520FormData>>({
    name: initialName,
    gender: initialGender,
    expectations: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function patch(p: Audience520Patch) {
    setData((prev) => ({ ...prev, ...p }));
  }

  function canSubmit(): boolean {
    return (
      !!data.name?.trim() &&
      !!data.gender &&
      !!data.currentCity?.trim() &&
      !!data.wechat?.trim() &&
      typeof data.inSwitzerland === "boolean" &&
      typeof data.willingToBePhotographed === "boolean" &&
      data.consent === true
    );
  }

  async function handleSubmit() {
    const result = validateAudience520(data);
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
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : te("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      className={`${aud520Theme.cardAccent} shadow-sm relative overflow-hidden`}
    >
      {/* Hanging lanterns at the corners — quiet decoration */}
      <span className="absolute -top-1 left-4 aud520-sway origin-top">
        <HangingLantern className="h-9 w-6" />
      </span>
      <span className="absolute -top-1 right-4 aud520-sway-slow origin-top">
        <HangingLantern className="h-9 w-6" />
      </span>

      <CardHeader className="pt-14">
        <CardTitle
          className={`${fontDisplayAud} text-xl ${aud520Theme.ink} flex items-center gap-3`}
        >
          <span className="h-px w-6 bg-[#5a8a6e]/40" />
          {ta("title")}
          <span className="h-px flex-1 bg-[#5a8a6e]/40" />
        </CardTitle>
        <p className={`text-sm ${aud520Theme.inkSoft}`}>{ta("intro")}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Name */}
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("name")}
            <span className="text-[#c84840]">*</span>
          </Label>
          <Input
            value={data.name ?? ""}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={tf("namePlaceholder")}
            required
          />
        </div>

        {/* Gender + City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="gap-0.5">
              {tf("gender")}
              <span className="text-[#c84840]">*</span>
            </Label>
            <Select
              value={data.gender ?? ""}
              onValueChange={(v) => patch({ gender: v as Gender })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_VALUES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {to(`gender.${g}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="gap-0.5">
              {tf("currentCity")}
              <span className="text-[#c84840]">*</span>
            </Label>
            <Input
              value={data.currentCity ?? ""}
              onChange={(e) => patch({ currentCity: e.target.value })}
              required
            />
          </div>
        </div>

        {/* WeChat */}
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("wechat")}
            <span className="text-[#c84840]">*</span>
          </Label>
          <Input
            value={data.wechat ?? ""}
            onChange={(e) => patch({ wechat: e.target.value })}
            placeholder={tf("wechatPlaceholder")}
            required
          />
          <p className={`text-xs ${aud520Theme.inkSoft}`}>
            {tf("wechatHelp")}
          </p>
        </div>

        {/* In Switzerland */}
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("inSwitzerland")}
            <span className="text-[#c84840]">*</span>
          </Label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="aud520-swiss"
                checked={data.inSwitzerland === true}
                onChange={() => patch({ inSwitzerland: true })}
                className="h-4 w-4"
              />
              {tyn("yes")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="aud520-swiss"
                checked={data.inSwitzerland === false}
                onChange={() => patch({ inSwitzerland: false })}
                className="h-4 w-4"
              />
              {tyn("no")}
            </label>
          </div>
        </div>

        {/* Photo consent */}
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("willingToBePhotographed")}
            <span className="text-[#c84840]">*</span>
          </Label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="aud520-photo"
                checked={data.willingToBePhotographed === true}
                onChange={() => patch({ willingToBePhotographed: true })}
                className="h-4 w-4"
              />
              {tyn("yes")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="aud520-photo"
                checked={data.willingToBePhotographed === false}
                onChange={() => patch({ willingToBePhotographed: false })}
                className="h-4 w-4"
              />
              {tyn("no")}
            </label>
          </div>
        </div>

        {/* Expectations — optional free text */}
        <div className="space-y-2">
          <Label>{tf("expectations")}</Label>
          <Textarea
            rows={3}
            maxLength={1000}
            value={data.expectations ?? ""}
            onChange={(e) => patch({ expectations: e.target.value })}
            placeholder={tf("expectationsPlaceholder")}
          />
        </div>

        {/* Consent */}
        <label className="flex items-start gap-2 text-sm pt-2">
          <input
            type="checkbox"
            checked={data.consent === true}
            onChange={(e) =>
              patch({ consent: e.target.checked ? true : undefined })
            }
            className="h-4 w-4 mt-0.5"
          />
          <span className={aud520Theme.inkSoft}>{tf("consent")}</span>
        </label>

        <div className="flex justify-end pt-3">
          <Button
            type="button"
            className={`${aud520Theme.gradientCta} px-8 py-5 rounded-full`}
            disabled={!canSubmit() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "…" : ta("submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
