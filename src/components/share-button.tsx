"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ShareButton({
  path,
  title,
  text,
  activityKind,
  variant = "outline",
  size = "sm",
}: {
  path: string;
  title?: string;
  text?: string;
  activityKind?: "registration" | "recap";
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  const t = useTranslations("common");
  const shareTitle = title && activityKind
    ? t(activityKind === "recap" ? "recapShareTitle" : "registrationShareTitle", { title })
    : title;

  async function handleShare() {
    const url = `${window.location.origin}${path}`;

    if (navigator.share) {
      try {
        const message = text || t(activityKind === "recap" ? "recapShareText" : "shareText");
        const shareText = shareTitle ? `${shareTitle}\n${message}` : message;
        await navigator.share({ url, title: shareTitle, text: shareText });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }

  return (
    <Button variant={variant} size={size} onClick={handleShare}>
      {t("share")}
    </Button>
  );
}
