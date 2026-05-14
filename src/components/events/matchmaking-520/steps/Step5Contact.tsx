"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoUpload } from "../PhotoUpload";
import type {
  Matchmaking520FormData,
  Matchmaking520Patch,
} from "@/lib/events/matchmaking-520";

export function Step5Contact({
  value,
  onChange,
  publicUrlFor,
}: {
  value: Partial<Matchmaking520FormData>;
  onChange: (p: Matchmaking520Patch) => void;
  publicUrlFor: (key: string) => string;
}) {
  const tf = useTranslations("events.matchmaking520.wizard.fields");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="gap-0.5">
          {tf("wechat")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          value={value.wechat ?? ""}
          onChange={(e) => onChange({ wechat: e.target.value })}
          required
        />
      </div>
      <PhotoUpload
        value={value.photoKey ?? ""}
        onChange={(key) => onChange({ photoKey: key })}
        publicUrlFor={publicUrlFor}
      />
      <label className="flex items-start gap-2 text-sm pt-2">
        <input
          type="checkbox"
          checked={value.consent === true}
          onChange={(e) =>
            onChange({ consent: e.target.checked ? true : undefined })
          }
          className="h-4 w-4 mt-0.5"
        />
        <span className="text-muted-foreground">{tf("consent")}</span>
      </label>
    </div>
  );
}
