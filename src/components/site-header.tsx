import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

type SiteHeaderUser = {
  name?: string | null;
  email?: string | null;
} | null;

export function SiteHeader({ user }: { user?: SiteHeaderUser }) {
  const t = useTranslations("common");
  const nav = useTranslations("nav");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <img src="/logo.jpg" alt="" className="h-8" />
          {t("appName")}
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.name || user.email}
              </span>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {nav("dashboard")}
              </Link>
            </>
          ) : (
            <Link
              href="/signin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {nav("signIn")}
            </Link>
          )}
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
