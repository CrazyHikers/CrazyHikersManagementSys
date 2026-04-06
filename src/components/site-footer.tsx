import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("common");

  return (
    <footer className="border-t bg-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-green-700">⛰</span>
            {t("appName")}
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {t("appName")}
          </p>
        </div>
      </div>
    </footer>
  );
}
