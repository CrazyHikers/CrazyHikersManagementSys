"use client";

import type { PerRegistrationExtrasProps } from "@/components/dashboard/template-extras-types";
import { AnswersDrawer } from "./AnswersDrawer";

export function Matchmaking520AnswersExtras({
  reg,
  publicUrlPrefix,
}: PerRegistrationExtrasProps) {
  if (!reg.formData) return null;
  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <AnswersDrawer
        formData={(reg.formData as Record<string, unknown> | null) ?? null}
        publicUrlFor={(key) => `${publicUrlPrefix ?? ""}/${key}`}
      />
    </div>
  );
}
