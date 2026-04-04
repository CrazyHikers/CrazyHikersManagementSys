"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function toggleLocale() {
    const next = locale === "zh" ? "en" : "zh";
    router.replace(pathname, { locale: next });
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleLocale}>
      {locale === "zh" ? "EN" : "中文"}
    </Button>
  );
}
