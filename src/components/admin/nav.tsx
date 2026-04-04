"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { key: "dashboard", href: "/admin" },
  { key: "activities", href: "/admin/activities" },
  { key: "members", href: "/admin/members" },
  { key: "managers", href: "/admin/managers" },
  { key: "waivers", href: "/admin/members/waivers" },
] as const;

function NavLinks({ onClick }: { onClick?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname.endsWith("/admin")
            : pathname.includes(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onClick}
            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-green-50 text-green-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </>
  );
}

export function AdminNav({
  managerName,
}: {
  managerName: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r bg-white">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="font-bold text-lg text-green-700">
            ⛰ {t("appName")}
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks />
        </nav>
        <div className="border-t p-3">
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {managerName}
          </div>
          <div className="flex items-center justify-between">
            <LocaleSwitcher />
            <form action="/api/auth/signout" method="POST">
              <Button variant="ghost" size="sm" type="submit">
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile header + sheet */}
      <div className="md:hidden sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-white px-4">
        <Link href="/" className="font-bold text-green-700">
          ⛰ {t("appName")}
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 hover:bg-accent hover:text-accent-foreground"
          >
            ☰
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-14 items-center border-b px-4">
              <span className="font-bold text-green-700">
                ⛰ {t("appName")}
              </span>
            </div>
            <nav className="p-3 space-y-1">
              <NavLinks onClick={() => setOpen(false)} />
            </nav>
            <div className="border-t p-3 mt-auto">
              <div className="text-xs text-muted-foreground mb-2">
                {managerName}
              </div>
              <div className="flex items-center justify-between">
                <LocaleSwitcher />
                <form action="/api/auth/signout" method="POST">
                  <Button variant="ghost" size="sm" type="submit">
                    {t("signOut")}
                  </Button>
                </form>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
