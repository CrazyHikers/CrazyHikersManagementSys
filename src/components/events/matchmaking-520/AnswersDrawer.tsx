"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  formData: Record<string, unknown> | null | undefined;
  publicUrlFor: (key: string) => string;
};

const FIELDS = [
  "name",
  "gender",
  "orientation",
  "birthYearMonth",
  "constellation",
  "mbti",
  "hometown",
  "school",
  "major",
  "stage",
  "currentCity",
  "heightCm",
  "weightKg",
  "hobbies",
  "selfIntro",
  "expectations",
  "wechat",
  "inSwitzerland",
  "interestedActivities",
] as const;

export function AnswersDrawer({ formData, publicUrlFor }: Props) {
  const tm = useTranslations("events.matchmaking520.manager");
  const tf = useTranslations("events.matchmaking520.wizard.fields");
  const to = useTranslations("events.matchmaking520.wizard.options");
  const tyn = useTranslations("events.matchmaking520.wizard.yesNo");

  if (!formData) return null;

  function fmt(field: (typeof FIELDS)[number]): string {
    const v = formData?.[field];
    if (v == null || v === "") return "—";
    if (field === "gender" && typeof v === "string") return to(`gender.${v}`);
    if (field === "orientation" && typeof v === "string") return to(`orientation.${v}`);
    if (field === "stage" && typeof v === "string") return to(`stage.${v}`);
    if (field === "inSwitzerland") return v ? tyn("yes") : tyn("no");
    if (field === "interestedActivities" && Array.isArray(v)) {
      return (v as string[]).map((k) => to(`interested.${k}`)).join(", ");
    }
    return String(v);
  }

  const photoKey =
    typeof formData.photoKey === "string" ? formData.photoKey : "";

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            {tm("viewAnswers")}
          </Button>
        }
      />
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tm("answersTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {photoKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicUrlFor(photoKey)}
              alt=""
              className="max-h-72 rounded-lg mx-auto"
            />
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {FIELDS.map((f) => (
              <div key={f}>
                <dt className="text-xs text-muted-foreground">{tf(f)}</dt>
                <dd className="font-medium whitespace-pre-wrap break-words">
                  {fmt(f)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
