"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Matchmaking520FormData,
  Matchmaking520Patch,
} from "@/lib/events/matchmaking-520";

export function Step2Personality({
  value,
  onChange,
}: {
  value: Partial<Matchmaking520FormData>;
  onChange: (p: Matchmaking520Patch) => void;
}) {
  const tf = useTranslations("events.matchmaking520.wizard.fields");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("constellation")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            value={value.constellation ?? ""}
            onChange={(e) => onChange({ constellation: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("mbti")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            value={value.mbti ?? ""}
            onChange={(e) => onChange({ mbti: e.target.value.toUpperCase() })}
            placeholder={tf("mbtiPlaceholder")}
            maxLength={4}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("heightCm")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min={100}
            max={250}
            value={value.heightCm ?? ""}
            onChange={(e) =>
              onChange({
                heightCm: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("weightKg")}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min={30}
            max={200}
            value={value.weightKg ?? ""}
            onChange={(e) =>
              onChange({
                weightKg: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            required
          />
        </div>
      </div>
    </div>
  );
}
