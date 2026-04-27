import { useTranslations } from "next-intl";
import { FeedbackDialog } from "@/components/feedback-dialog";

export function SiteFooter() {
  const t = useTranslations("common");

  return (
    <footer className="border-t bg-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <img src="/logo.jpg" alt="" className="h-6" />
            {t("appName")}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
            <FeedbackDialog />
            <p>
              &copy; {new Date().getFullYear()} {t("appName")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
