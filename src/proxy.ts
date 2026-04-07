import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

// Routes that don't require password check
const PASSWORD_EXEMPT_PATHS = [
  "/set-password",
  "/signin",
  "/signup",
  "/verify",
];

function isPasswordExempt(pathname: string): boolean {
  // Strip locale prefix (e.g., /en/signin -> /signin)
  const withoutLocale = pathname.replace(/^\/(en|zh)/, "");
  return PASSWORD_EXEMPT_PATHS.some((path) => withoutLocale.startsWith(path));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip i18n and auth checks for API routes and internal Next.js routes
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check session for password requirement on non-exempt routes
  if (!isPasswordExempt(pathname)) {
    const session = await auth();

    if (session?.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = session.user as any;
      if (!user.hasPassword) {
        // Determine locale from pathname
        const localeMatch = pathname.match(/^\/(en|zh)/);
        const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
        const setPasswordUrl = new URL(`/${locale}/set-password`, request.url);
        return NextResponse.redirect(setPasswordUrl);
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
