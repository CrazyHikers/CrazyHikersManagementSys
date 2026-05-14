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
  GENDER_VALUES,
  ORIENTATION_VALUES,
  type Gender,
  type Orientation,
  type Matchmaking520FormData,
  type Matchmaking520Patch,
} from "@/lib/events/matchmaking-520";

type Props = {
  value: Partial<Matchmaking520FormData>;
  onChange: (patch: Matchmaking520Patch) => void;
};

export function Step1Basic({ value, onChange }: Props) {
  const tf = useTranslations("events.matchmaking520.wizard.fields");
  const to = useTranslations("events.matchmaking520.wizard.options");
  const tyn = useTranslations("events.matchmaking520.wizard.yesNo");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("name")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          value={value.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={tf("namePlaceholder")}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="gap-0.5">
            {tf("gender")}
            <span className="text-red-500">*</span>
          </Label>
          <Select
            value={value.gender ?? ""}
            onValueChange={(v) => onChange({ gender: v as Gender })}
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
            {tf("orientation")}
            <span className="text-red-500">*</span>
          </Label>
          <Select
            value={value.orientation ?? ""}
            onValueChange={(v) => onChange({ orientation: v as Orientation })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIENTATION_VALUES.map((o) => (
                <SelectItem key={o} value={o}>
                  {to(`orientation.${o}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("birthYearMonth")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          type="month"
          value={value.birthYearMonth ?? ""}
          onChange={(e) => onChange({ birthYearMonth: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("inSwitzerland")}
          <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="m520-swiss"
              checked={value.inSwitzerland === true}
              onChange={() => onChange({ inSwitzerland: true })}
              className="h-4 w-4"
            />
            {tyn("yes")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="m520-swiss"
              checked={value.inSwitzerland === false}
              onChange={() => onChange({ inSwitzerland: false })}
              className="h-4 w-4"
            />
            {tyn("no")}
          </label>
        </div>
      </div>
    </div>
  );
}
