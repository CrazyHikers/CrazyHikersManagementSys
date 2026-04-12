"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "cookie_consent";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function CookieBanner() {
  const t = useTranslations("cookieBanner");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookie(COOKIE_NAME)) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    setCookie(COOKIE_NAME, "accepted", 365);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg p-4">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          {t("message")}
        </p>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 flex-shrink-0"
          onClick={handleAccept}
        >
          {t("accept")}
        </Button>
      </div>
    </div>
  );
}
