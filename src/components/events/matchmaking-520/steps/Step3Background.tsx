"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STAGE_VALUES,
  type Stage,
  type Matchmaking520FormData,
  type Matchmaking520Patch,
} from "@/lib/events/matchmaking-520";

export function Step3Background({
  value,
  onChange,
}: {
  value: Partial<Matchmaking520FormData>;
  onChange: (p: Matchmaking520Patch) => void;
}) {
  const tf = useTranslations("events.matchmaking520.wizard.fields");
  const to = useTranslations("events.matchmaking520.wizard.options.stage");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{tf("hometown")}</Label>
        <Input
          value={value.hometown ?? ""}
          onChange={(e) => onChange({ hometown: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{tf("school")}</Label>
          <Input
            value={value.school ?? ""}
            onChange={(e) => onChange({ school: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tf("major")}</Label>
          <Input
            value={value.major ?? ""}
            onChange={(e) => onChange({ major: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{tf("stage")}</Label>
          <Select
            value={value.stage ?? ""}
            onValueChange={(v) => onChange({ stage: v as Stage })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {to(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{tf("currentCity")}</Label>
          <Input
            value={value.currentCity ?? ""}
            onChange={(e) => onChange({ currentCity: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
