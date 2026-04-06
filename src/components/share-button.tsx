"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ShareButton({
  path,
  variant = "outline",
  size = "sm",
}: {
  path: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  const t = useTranslations("common");

  async function handleShare() {
    const url = `${window.location.origin}${path}`;

    if (navigator.share) {
      try {
        await navigator.share({ url });
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
