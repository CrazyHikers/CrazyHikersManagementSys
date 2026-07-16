"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

type NavItem = {
  key: string;
  href: string;
};

const memberItems: NavItem[] = [
  { key: "dashboard", href: "/dashboard" },
  { key: "myActivities", href: "/dashboard/my-activities" },
  { key: "myWaivers", href: "/dashboard/my-waivers" },
  { key: "myProfile", href: "/dashboard/my-profile" },
  { key: "polls", href: "/dashboard/polls" },
];

const managerItems: NavItem[] = [
  { key: "activities", href: "/dashboard/activities" },
];

const internResourcesItem: NavItem = {
  key: "myFiles",
  href: "/dashboard/my-files",
};

const adminItems: NavItem[] = [
  { key: "createPoll", href: "/dashboard/polls/new" },
  { key: "allActivities", href: "/dashboard/all-activities" },
  { key: "members", href: "/dashboard/members" },
  { key: "waivers", href: "/dashboard/members/waivers" },
  { key: "flags", href: "/dashboard/flags" },
  { key: "managers", href: "/dashboard/managers" },
  { key: "internResources", href: "/dashboard/intern-resources" },
  { key: "settings", href: "/dashboard/settings" },
];

function NavLinks({
  role,
  canReadInternResources,
  onClick,
}: {
  role: string;
  canReadInternResources: boolean;
  onClick?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  function isActive(href: string) {
    const path = pathname.replace(/^\/(en|zh)/, "");
    return path === href;
  }

  function renderItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={onClick}
        className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          active
            ? "bg-green-50 text-green-700"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        {t(item.key)}
      </Link>
    );
  }

  const isManager = role === "manager" || role === "admin" || role === "dev";
  const isAdmin = role === "admin" || role === "dev";

  return (
    <>
      {memberItems.map(renderItem)}
      {isManager && (
        <>
          <Separator className="my-2" />
          {managerItems.map(renderItem)}
        </>
      )}
      {canReadInternResources && renderItem(internResourcesItem)}
      {isAdmin && (
        <>
          <Separator className="my-2" />
          {adminItems.map(renderItem)}
        </>
      )}
    </>
  );
}

export function DashboardNav({
  role,
  userName,
  canReadInternResources,
}: {
  role: string;
  userName: string;
  canReadInternResources: boolean;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r bg-white">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-foreground">
            <img src="/logo.jpg" alt="" className="h-8" />
            {t("appName")}
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks role={role} canReadInternResources={canReadInternResources} />
        </nav>
        <div className="border-t p-3">
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {userName}
          </div>
          <div className="flex items-center justify-between">
            <LocaleSwitcher />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              {t("signOut")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile header + sheet */}
      <div className="md:hidden sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-white px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
          <img src="/logo.jpg" alt="" className="h-7" />
          {t("appName")}
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 hover:bg-accent hover:text-accent-foreground">
            ☰
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-14 items-center border-b px-4">
              <span className="flex items-center gap-2 font-bold text-green-700">
                <img src="/logo.jpg" alt="" className="h-7" />
                {t("appName")}
              </span>
            </div>
            <nav className="p-3 space-y-1">
              <NavLinks
                role={role}
                canReadInternResources={canReadInternResources}
                onClick={() => setOpen(false)}
              />
            </nav>
            <div className="border-t p-3 mt-auto">
              <div className="text-xs text-muted-foreground mb-2">
                {userName}
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
