"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ActivityEditForm } from "./activity-edit-form";

type ActivityData = {
  id: string;
  title: string;
  description: string;
  deadline: string;
  date: string;
  capacity: number;
  maximumRegistration: number | null;
  coverImgId: string;
  homepageThumbnailImgId: string | null;
  registrationHeroImgId: string | null;
  metadata?: Record<string, unknown> | null;
};

export function EditButton({
  activity,
}: {
  activity: ActivityData;
}) {
  const t = useTranslations("dashboard.activities");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ActivityEditForm
        activity={activity}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
      {t("edit")}
    </Button>
  );
}
