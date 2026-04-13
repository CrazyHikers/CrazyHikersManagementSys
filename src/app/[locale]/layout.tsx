import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/cookie-banner";
import { SessionProvider } from "@/components/session-provider";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <SessionProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
        <Toaster />
        <CookieBanner />
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
