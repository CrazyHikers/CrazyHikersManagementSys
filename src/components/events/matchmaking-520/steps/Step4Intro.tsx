"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INTERESTED_ACTIVITY_VALUES,
  type InterestedActivity,
  type Matchmaking520FormData,
  type Matchmaking520Patch,
} from "@/lib/events/matchmaking-520";

export function Step4Intro({
  value,
  onChange,
}: {
  value: Partial<Matchmaking520FormData>;
  onChange: (p: Matchmaking520Patch) => void;
}) {
  const tf = useTranslations("events.matchmaking520.wizard.fields");
  const to = useTranslations("events.matchmaking520.wizard.options.interested");

  function toggle(opt: InterestedActivity, checked: boolean) {
    const cur = value.interestedActivities ?? [];
    onChange({
      interestedActivities: checked
        ? [...cur, opt]
        : cur.filter((x) => x !== opt),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("hobbies")}
          <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={3}
          value={value.hobbies ?? ""}
          onChange={(e) => onChange({ hobbies: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("selfIntro")}
          <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={4}
          value={value.selfIntro ?? ""}
          onChange={(e) => onChange({ selfIntro: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("expectations")}
          <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={4}
          value={value.expectations ?? ""}
          onChange={(e) => onChange({ expectations: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("interestedActivities")}
          <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {INTERESTED_ACTIVITY_VALUES.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(value.interestedActivities ?? []).includes(opt)}
                onChange={(e) => toggle(opt, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {to(opt)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
