import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteHeader() {
  const t = useTranslations("common");
  const nav = useTranslations("nav");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-green-700">⛰</span>
          {t("appName")}
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {nav("admin")}
          </Link>
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
